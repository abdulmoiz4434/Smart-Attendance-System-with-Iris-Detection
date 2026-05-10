import cv2
import numpy as np
from scipy.ndimage import convolve
from typing import List, Optional, Tuple
from PIL import Image



# ── Gabor filter bank ────────────────────────────────────────────────────────

def build_gabor_bank(
    num_scales: int = 4,
    num_orientations: int = 8,
    ksize: int = 31,
) -> List[np.ndarray]:
    """Build a bank of Gabor filters at multiple scales and orientations."""
    filters = []
    for scale in range(num_scales):
        wavelength = 2 ** (scale + 1)
        for orientation in range(num_orientations):
            theta = orientation * np.pi / num_orientations
            kernel = cv2.getGaborKernel(
                ksize=(ksize, ksize),
                sigma=wavelength * 0.56,
                theta=theta,
                lambd=wavelength,
                gamma=0.5,
                psi=0,
                ktype=cv2.CV_32F,
            )
            kernel /= (kernel.sum() + 1e-8)
            filters.append(kernel)
    return filters


GABOR_BANK = build_gabor_bank()  # Built once at module load


def extract_gabor_features(gray_roi: np.ndarray) -> np.ndarray:
    """
    Apply Gabor bank to a grayscale iris ROI.
    Returns a normalised 512-float feature vector.
    """
    resized = cv2.resize(gray_roi, (64, 64))
    responses = []
    for kernel in GABOR_BANK:
        response = cv2.filter2D(resized.astype(np.float32), -1, kernel)
        responses.append(response.mean())
        responses.append(response.var())
    vec = np.array(responses, dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec  # 512 floats (4 scales × 8 orientations × 2 stats)


# ── Preprocessing ─────────────────────────────────────────────────────────────

def _detect_face(gray: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    """
    Run Haar cascade face detection. Returns (x, y, w, h) of the largest
    detected face, or None if no face found.
    Uses two passes: strict first, relaxed second (handles close-up selfies).
    """
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )
    # Strict pass — avoids false positives on walls/ceilings
    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80)
    )
    if len(faces) == 0:
        # Relaxed pass — handles close-up selfies where face fills frame
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=3, minSize=(50, 50)
        )
    if len(faces) == 0:
        return None
    # Return largest face
    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    x, y, w, h = faces[0]
    return (x, y, w, h)


def preprocess_iris(image_bytes: bytes, require_face: bool = True) -> np.ndarray | None:
    """
    Preprocess an iris image from raw bytes.
    Returns a grayscale ROI (iris crop or eye region) or None if rejected.

    require_face=True (default for verify): rejects images with no detected face.
    require_face=False (enrollment fallback): allows full-image Gabor if no face.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    gray_full = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    face = _detect_face(gray_full)

    if face is None:
        if require_face:
            # Hard reject — no face means not a valid iris capture
            return None
        # Enrollment fallback: use full image (caller decides)
        gray = gray_full
    else:
        x, y, w, h = face
        face_roi = img[y:y+h, x:x+w]
        gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)

    # CLAHE contrast normalisation
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Hough circle detection within face ROI
    blurred = cv2.GaussianBlur(enhanced, (9, 9), 2)
    height, width = blurred.shape
    min_r = int(min(height, width) * 0.10)
    max_r = int(min(height, width) * 0.40)

    circles = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT,
        dp=1.2, minDist=min(height, width) // 4,
        param1=50, param2=30,
        minRadius=min_r, maxRadius=max_r,
    )

    if circles is not None:
        circles = np.uint16(np.around(circles))
        cx, cy, r = circles[0][0]
        x1 = max(0, int(cx - r))
        y1 = max(0, int(cy - r))
        x2 = min(width, int(cx + r))
        y2 = min(height, int(cy + r))
        roi = enhanced[y1:y2, x1:x2]
        if roi.size == 0:
            return enhanced
        return roi
    else:
        # No iris circle — use upper-half of face (eye region)
        h, w = enhanced.shape
        return enhanced[0:h//2, :]


# ── Cosine similarity ─────────────────────────────────────────────────────────

def cosine_similarity(a: List[float], b: List[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = (np.linalg.norm(va) * np.linalg.norm(vb))
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


# ── Public pipeline functions ─────────────────────────────────────────────────

def compute_embedding_from_bytes(image_bytes: bytes, require_face: bool = True):
    """
    Extract a 512-float iris embedding from raw image bytes.
    Primary: PyTorch CNN (IrisEmbeddingNet) if iris_model.pt is present.
    Fallback: Gabor filter bank (always available, no extra deps).

    require_face=True (default): returns None if no face detected — hard reject.
    require_face=False: used during enrollment where close-up may skip cascade.
    """
    roi = preprocess_iris(image_bytes, require_face=require_face)
    if roi is None or roi.size == 0:
        return None

    # Try CNN first (optional — only if model file exists)
    try:
        from app.ml.pytorch_model import extract_cnn_embedding
        vec = extract_cnn_embedding(roi)
        if vec is not None:
            return vec
    except Exception:
        pass

    # Gabor fallback — always works
    return extract_gabor_features(roi)


def average_embeddings(embeddings: List[np.ndarray]) -> np.ndarray:
    """Element-wise average of a list of embeddings, then re-normalise."""
    stacked = np.stack(embeddings, axis=0)
    avg = stacked.mean(axis=0)
    norm = np.linalg.norm(avg)
    if norm > 0:
        avg = avg / norm
    return avg
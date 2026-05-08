import cv2
import numpy as np
from scipy.ndimage import convolve
from typing import List
import io
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

def preprocess_iris(image_bytes: bytes) -> np.ndarray | None:
    """
    Decode image bytes → grayscale → CLAHE → detect iris ROI via Hough.
    Returns the cropped, normalised iris ROI or None if detection fails.
    """
    # Decode
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # CLAHE contrast normalisation
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Detect iris boundary using Hough circles
    blurred = cv2.GaussianBlur(enhanced, (9, 9), 2)
    height, width = blurred.shape
    min_r = int(min(height, width) * 0.15)
    max_r = int(min(height, width) * 0.50)

    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=min(height, width) // 4,
        param1=50,
        param2=30,
        minRadius=min_r,
        maxRadius=max_r,
    )

    if circles is not None:
        circles = np.uint16(np.around(circles))
        cx, cy, r = circles[0][0]

        # Crop and resize to a square ROI
        x1 = max(0, int(cx - r))
        y1 = max(0, int(cy - r))
        x2 = min(width,  int(cx + r))
        y2 = min(height, int(cy + r))
        roi = enhanced[y1:y2, x1:x2]

        if roi.size == 0:
            return enhanced   # Fallback: use the full enhanced image
        return roi
    else:
        # Hough failed — fall back to centre crop (common for close-up iris images)
        h, w = enhanced.shape
        margin = int(min(h, w) * 0.15)
        return enhanced[margin: h - margin, margin: w - margin]


# ── Cosine similarity ─────────────────────────────────────────────────────────

def cosine_similarity(a: List[float], b: List[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = (np.linalg.norm(va) * np.linalg.norm(vb))
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


# ── Public pipeline functions ─────────────────────────────────────────────────

def compute_embedding_from_bytes(image_bytes: bytes) -> np.ndarray | None:
    """Full pipeline: bytes → ROI → CNN embedding (or Gabor fallback)."""
    roi = preprocess_iris(image_bytes)
    if roi is None:
        return None

    # Try CNN first
    try:
        from app.ml.pytorch_model import extract_cnn_embedding
        cnn_emb = extract_cnn_embedding(roi)
        if cnn_emb is not None:
            return cnn_emb
    except Exception:
        pass  # Fall through to Gabor

    return extract_gabor_features(roi)


def average_embeddings(embeddings: List[np.ndarray]) -> np.ndarray:
    """Element-wise average of a list of embeddings, then re-normalise."""
    stacked = np.stack(embeddings, axis=0)
    avg = stacked.mean(axis=0)
    norm = np.linalg.norm(avg)
    if norm > 0:
        avg = avg / norm
    return avg
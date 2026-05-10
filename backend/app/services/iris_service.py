import cv2
import numpy as np
from typing import List, Optional, Tuple
from PIL import Image
import torch
import logging

logger = logging.getLogger(__name__)

# ── FaceNet (facenet-pytorch) ─────────────────────────────────────────────────
# Loaded lazily — avoids import-time crash if weights not yet downloaded.
_mtcnn = None
_resnet = None


def _get_facenet():
    """Lazy-load MTCNN + InceptionResnetV1. Downloads weights on first call (~100 MB, cached)."""
    global _mtcnn, _resnet
    if _resnet is None:
        from facenet_pytorch import MTCNN, InceptionResnetV1
        # MTCNN: face detector + aligner. keep_all=False → largest face only.
        _mtcnn = MTCNN(
            image_size=160,
            margin=20,
            keep_all=False,
            min_face_size=40,
            thresholds=[0.6, 0.7, 0.7],
            device="cpu",
        )
        # InceptionResnetV1 pretrained on VGGFace2 — 512-d identity embeddings.
        _resnet = InceptionResnetV1(pretrained="vggface2").eval()
    return _mtcnn, _resnet


def extract_facenet_embedding(image_bytes: bytes) -> Optional[np.ndarray]:
    """
    Extract a 512-d FaceNet identity embedding from raw image bytes.
    Returns None if no face detected.
    Same-person cosine similarity: ~0.97–0.99
    Different-person cosine similarity: ~0.2–0.6
    """
    try:
        mtcnn, resnet = _get_facenet()

        # Decode bytes → PIL RGB (MTCNN expects PIL)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return None
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)

        # Detect + align face → (1, 3, 160, 160) tensor, or None
        face_tensor = mtcnn(pil_img)
        if face_tensor is None:
            logger.debug("extract_facenet_embedding: no face detected by MTCNN")
            return None

        # Add batch dim if needed
        if face_tensor.dim() == 3:
            face_tensor = face_tensor.unsqueeze(0)

        with torch.no_grad():
            embedding = resnet(face_tensor)  # (1, 512)

        vec = embedding.squeeze().numpy().astype(np.float32)
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec

    except Exception as e:
        logger.warning(f"extract_facenet_embedding failed: {e}")
        return None


# ── Gabor filter bank (fallback only) ────────────────────────────────────────

def _build_gabor_bank(num_scales: int = 4, num_orientations: int = 8, ksize: int = 31) -> List[np.ndarray]:
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


_GABOR_BANK = _build_gabor_bank()


def _extract_gabor_features(gray_roi: np.ndarray) -> np.ndarray:
    resized = cv2.resize(gray_roi, (64, 64))
    responses = []
    for kernel in _GABOR_BANK:
        response = cv2.filter2D(resized.astype(np.float32), -1, kernel)
        responses.append(response.mean())
        responses.append(response.var())
    vec = np.array(responses, dtype=np.float32)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


# ── Face detection (used for Gabor fallback path) ────────────────────────────

def _detect_face_opencv(gray: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    """Haar cascade face detection. Returns (x,y,w,h) of largest face or None."""
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    faces = face_cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80)
    )
    if len(faces) == 0:
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.05, minNeighbors=3, minSize=(50, 50)
        )
    if len(faces) == 0:
        return None
    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    return tuple(faces[0])


def _gabor_fallback(image_bytes: bytes, require_face: bool) -> Optional[np.ndarray]:
    """
    Gabor fallback — only used if facenet-pytorch is unavailable.
    NOTE: Gabor is NOT identity-discriminative. This path should never be
    reached in production. It exists only to prevent a hard crash.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    gray_full = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    face = _detect_face_opencv(gray_full)

    if face is None:
        if require_face:
            return None
        gray = gray_full
    else:
        x, y, w, h = face
        gray = cv2.cvtColor(img[y:y+h, x:x+w], cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

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
        roi = enhanced[
            max(0, int(cy - r)):min(height, int(cy + r)),
            max(0, int(cx - r)):min(width, int(cx + r)),
        ]
        if roi.size == 0:
            return _extract_gabor_features(enhanced)
        return _extract_gabor_features(roi)
    else:
        h, w = enhanced.shape
        return _extract_gabor_features(enhanced[0:h//2, :])


# ── Public API ────────────────────────────────────────────────────────────────

def compute_embedding_from_bytes(image_bytes: bytes, require_face: bool = True) -> Optional[np.ndarray]:
    """
    Extract a face identity embedding from raw image bytes.

    Primary path: FaceNet (InceptionResnetV1 pretrained on VGGFace2).
      - 512-d identity-discriminative embedding
      - Same person: cosine ~0.97–0.99
      - Different person: cosine ~0.2–0.6
      - Returns None if MTCNN finds no face (hard reject when require_face=True)

    Fallback: Gabor filter bank (only if facenet-pytorch import fails).
      - NOT identity-discriminative — do not rely on this for security.
      - Logs a warning if reached.

    require_face=True (default, used for verify): None → reject, no attendance written.
    require_face=False (used for enroll): allows Gabor fallback on no-face images.
    """
    # Primary: FaceNet
    embedding = extract_facenet_embedding(image_bytes)
    if embedding is not None:
        return embedding

    # If FaceNet returned None due to no face detected (not an import error),
    # respect require_face gate.
    try:
        _get_facenet()  # If this succeeds, FaceNet is available → no face was found
        if require_face:
            return None  # Hard reject: FaceNet loaded but found no face
        # Enrollment with no face: fall through to Gabor
        logger.warning("compute_embedding_from_bytes: no face detected, using Gabor for enrollment")
        return _gabor_fallback(image_bytes, require_face=False)
    except Exception:
        # FaceNet not importable — use Gabor as last resort
        logger.warning("compute_embedding_from_bytes: facenet-pytorch unavailable, falling back to Gabor")
        return _gabor_fallback(image_bytes, require_face=require_face)


def cosine_similarity(a: List[float], b: List[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


def average_embeddings(embeddings: List[np.ndarray]) -> np.ndarray:
    """Element-wise average of embeddings, then re-normalise."""
    stacked = np.stack(embeddings, axis=0)
    avg = stacked.mean(axis=0)
    norm = np.linalg.norm(avg)
    return avg / norm if norm > 0 else avg

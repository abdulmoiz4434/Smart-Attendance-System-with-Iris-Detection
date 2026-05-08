import time
import requests
import cloudinary
import cloudinary.uploader
from google.cloud.firestore_v1 import DocumentSnapshot
from typing import Optional, List
from app.firebase_init import get_firestore
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

# Configure Cloudinary once at import time
cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True,
)


def upload_image_bytes(image_bytes: bytes, folder: str = "iris") -> str:
    """
    Upload raw image bytes to Cloudinary.
    Returns the secure URL of the uploaded image.
    """
    result = cloudinary.uploader.upload(
        image_bytes,
        folder=folder,
        resource_type="image",
    )
    return result["secure_url"]


def download_image_bytes(image_url: str, retries: int = 2) -> bytes:
    """
    Download image bytes from a Cloudinary URL (or any HTTPS URL).
    Replaces the old Firebase Storage download function.
    """
    last_error: Optional[Exception] = None
    for attempt in range(retries):
        try:
            response = requests.get(image_url, timeout=15)
            response.raise_for_status()
            return response.content
        except Exception as e:
            last_error = e
            if attempt < retries - 1:
                time.sleep(1)
    raise last_error or RuntimeError(
        f"Failed to download image after {retries} attempts: {image_url}"
    )


def get_student_embedding(uid: str) -> Optional[List[float]]:
    """Fetch irisEmbedding list from students/{uid}. Returns list or None."""
    db = get_firestore()
    doc: DocumentSnapshot = db.collection("students").document(uid).get()  # type: ignore[assignment]
    if not doc.exists:
        return None
    data: Optional[dict] = doc.to_dict()
    if data is None:
        return None
    embedding: List[float] = data.get("irisEmbedding", [])
    return embedding if len(embedding) > 0 else None
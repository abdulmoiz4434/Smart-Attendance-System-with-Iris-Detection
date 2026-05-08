from app.firebase_init import get_bucket, get_firestore
import io
import time


def download_image_bytes(storage_path: str, retries: int = 2) -> bytes:
    """Download a file from Firebase Storage with simple retry."""
    bucket = get_bucket()
    blob = bucket.blob(storage_path)
    last_error = None
    for attempt in range(retries):
        try:
            buffer = io.BytesIO()
            blob.download_to_file(buffer)
            buffer.seek(0)
            return buffer.read()
        except Exception as e:
            last_error = e
            if attempt < retries - 1:
                time.sleep(1)
    raise last_error


def get_student_embedding(uid: str):
    """Fetch irisEmbedding list from students/{uid}. Returns list or None."""
    db = get_firestore()
    doc = db.collection("students").document(uid).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    embedding = data.get("irisEmbedding", [])
    return embedding if len(embedding) > 0 else None
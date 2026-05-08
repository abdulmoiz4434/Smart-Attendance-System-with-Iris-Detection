import os
from dotenv import load_dotenv

load_dotenv()

FIREBASE_CREDENTIALS_PATH = os.getenv(
    "FIREBASE_CREDENTIALS_PATH",
    "./firebase-service-account.json"
)
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
MOBILE_ORIGIN   = os.getenv("MOBILE_ORIGIN", "http://localhost:8081")
ENVIRONMENT     = os.getenv("ENVIRONMENT", "development")

# Cloudinary (replaces Firebase Storage)
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY    = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")


def validate_config():
    missing = []
    if not os.path.exists(FIREBASE_CREDENTIALS_PATH) and not os.getenv("FIREBASE_CREDENTIALS_JSON"):
        missing.append("FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON")
    if not CLOUDINARY_CLOUD_NAME:
        missing.append("CLOUDINARY_CLOUD_NAME")
    if not CLOUDINARY_API_KEY:
        missing.append("CLOUDINARY_API_KEY")
    if not CLOUDINARY_API_SECRET:
        missing.append("CLOUDINARY_API_SECRET")
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")
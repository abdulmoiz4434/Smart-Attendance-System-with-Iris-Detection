import os
from dotenv import load_dotenv

load_dotenv()

FIREBASE_CREDENTIALS_PATH = os.getenv(
    "FIREBASE_CREDENTIALS_PATH",
    "./firebase-service-account.json"
)
FIREBASE_STORAGE_BUCKET  = os.getenv("FIREBASE_STORAGE_BUCKET")
FRONTEND_ORIGIN          = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
MOBILE_ORIGIN            = os.getenv("MOBILE_ORIGIN", "http://localhost:8081")
ENVIRONMENT              = os.getenv("ENVIRONMENT", "development")

# Validate required vars at startup
def validate_config():
    missing = []
    if not FIREBASE_STORAGE_BUCKET:
        missing.append("FIREBASE_STORAGE_BUCKET")
    if not os.path.exists(FIREBASE_CREDENTIALS_PATH) and not os.getenv("FIREBASE_CREDENTIALS_JSON"):
        missing.append("FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON")
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")
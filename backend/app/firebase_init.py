import firebase_admin
from firebase_admin import credentials, firestore, auth
from app.config import FIREBASE_CREDENTIALS_PATH
import os
import json

_app = None


def initialize_firebase():
    global _app
    if firebase_admin._apps:
        return

    # Render stores the service account JSON as an env var
    creds_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    if creds_json:
        cred_dict = json.loads(creds_json)
        cred = credentials.Certificate(cred_dict)
    else:
        cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)

    # No storageBucket needed — we use Cloudinary for file storage
    _app = firebase_admin.initialize_app(cred)


def get_firestore():
    return firestore.client()


def get_auth():
    return auth
"""
One-time seed: writes systemConfig/main to Firestore.
Run from the backend/ directory: python seed_config.py
"""
from firebase_admin import firestore
from app.firebase_init import initialize_firebase
from datetime import datetime, timezone

initialize_firebase()
db = firestore.client()

db.collection("systemConfig").document("main").set({
    "attendanceThreshold": 75,
    "irisMatchThreshold": 0.80,
    "maxIrisRetries": 3,
    "manualMarkingEnabled": True,
    "updatedAt": datetime.now(timezone.utc),
    "updatedBy": "system",
})

print("systemConfig/main seeded successfully.")
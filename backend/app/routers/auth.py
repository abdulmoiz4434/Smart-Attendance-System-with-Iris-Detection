from fastapi import APIRouter, HTTPException
from app.models.schemas import TokenVerifyRequest, TokenVerifyResponse
from app.firebase_init import get_auth, get_firestore

router = APIRouter()

@router.post("/verify-token", response_model=TokenVerifyResponse)
async def verify_token(payload: TokenVerifyRequest):
    try:
        decoded = get_auth().verify_id_token(payload.idToken)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = decoded["uid"]
    db = get_firestore()
    user_doc = db.collection("users").document(uid).get()

    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found in Firestore")

    user_data = user_doc.to_dict()

    if user_data.get("status") == "inactive":
        raise HTTPException(status_code=403, detail="Account is inactive")

    return TokenVerifyResponse(
        uid=uid,
        role=user_data["role"],
        email=user_data["email"],
        status=user_data["status"],
    )
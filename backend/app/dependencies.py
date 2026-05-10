from fastapi import Header, HTTPException, Depends
import jwt
import os

from app.firebase_init import get_firestore

JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"


async def get_current_user(authorization: str = Header(...)):
    """
    Validates the custom JWT issued by /api/auth/mobile-login.
    The old implementation called Firebase's verify_id_token(), which only
    accepts Firebase ID tokens — not the custom JWTs the mobile app stores
    in AsyncStorage.  Using PyJWT decode here fixes the 401 errors on every
    protected endpoint after mobile login.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.split("Bearer ")[1]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = payload.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    db = get_firestore()
    user_doc = db.collection("users").document(uid).get()

    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User profile not found")

    user_data = user_doc.to_dict()

    if user_data.get("status") == "inactive":
        raise HTTPException(status_code=403, detail="Account is inactive")

    return {**user_data, "uid": uid}


def require_role(*roles):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker
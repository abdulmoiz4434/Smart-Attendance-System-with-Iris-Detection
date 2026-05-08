from fastapi import Header, HTTPException
from fastapi import Depends

from app.firebase_init import get_auth, get_firestore

async def get_current_user(authorization: str = Header(...)):
    """
    Validates the Firebase ID token from the Authorization header.
    Returns the decoded token dict with uid, role, status.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    
    id_token = authorization.split("Bearer ")[1]
    
    try:
        decoded = get_auth().verify_id_token(id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    uid = decoded["uid"]
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
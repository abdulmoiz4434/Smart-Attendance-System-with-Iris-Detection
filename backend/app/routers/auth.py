from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.schemas import TokenVerifyRequest, TokenVerifyResponse
from app.firebase_init import get_auth, get_firestore
import jwt
import os
from datetime import datetime, timedelta
from pydantic import BaseModel

router = APIRouter()

JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72

security = HTTPBearer()


class MobileLoginRequest(BaseModel):
    email: str
    password: str


class MobileLoginResponse(BaseModel):
    token: str
    user: dict


class WebLoginRequest(BaseModel):
    idToken: str


def create_jwt(uid: str, role: str, email: str) -> str:
    payload = {
        "uid": uid,
        "role": role,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


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


@router.post("/mobile-login", response_model=MobileLoginResponse)
async def mobile_login(payload: MobileLoginRequest):
    import httpx
    firebase_api_key = os.getenv("FIREBASE_WEB_API_KEY")
    if not firebase_api_key:
        raise HTTPException(status_code=500, detail="Firebase API key not configured")

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={firebase_api_key}",
            json={"email": payload.email, "password": payload.password, "returnSecureToken": True},
        )

    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    firebase_uid = res.json()["localId"]

    db = get_firestore()
    user_doc = db.collection("users").document(firebase_uid).get()

    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = user_doc.to_dict()

    if user_data.get("status") == "inactive":
        raise HTTPException(status_code=403, detail="Account is inactive")

    token = create_jwt(firebase_uid, user_data["role"], user_data["email"])

    return MobileLoginResponse(
        token=token,
        user={
            "uid": firebase_uid,
            "role": user_data["role"],
            "email": user_data["email"],
            "name": user_data.get("name", ""),
            "status": user_data["status"],
        }
    )


@router.post("/web-login")
async def web_login(payload: WebLoginRequest):
    try:
        decoded = get_auth().verify_id_token(payload.idToken)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    uid = decoded["uid"]
    db = get_firestore()
    user_doc = db.collection("users").document(uid).get()

    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = user_doc.to_dict()

    if user_data.get("status") == "inactive":
        raise HTTPException(status_code=403, detail="Account is inactive")

    token = create_jwt(uid, user_data["role"], user_data["email"])

    return {
        "token": token,
        "user": {
            "uid": uid,
            "role": user_data["role"],
            "email": user_data["email"],
            "name": user_data.get("name", ""),
            "status": user_data["status"],
        }
    }


@router.get("/me")
async def get_me(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_jwt(credentials.credentials)
    uid = payload["uid"]

    db = get_firestore()
    user_doc = db.collection("users").document(uid).get()

    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = user_doc.to_dict()
    return {
        "uid": uid,
        "role": user_data["role"],
        "email": user_data["email"],
        "name": user_data.get("name", ""),
        "status": user_data["status"],
    }
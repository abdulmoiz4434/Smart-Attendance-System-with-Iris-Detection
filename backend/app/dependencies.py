from fastapi import Header, HTTPException, Depends
import jwt
import os
import time

from app.firebase_init import get_firestore

JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

# In-process user profile cache: token → (user_dict, expires_at)
# Avoids a Firestore read on every single request.
# TTL = 5 minutes. Invalidated immediately on inactive status.
_USER_CACHE: dict = {}
_CACHE_TTL = 300  # seconds


def _cache_get(token: str):
    entry = _USER_CACHE.get(token)
    if entry and time.monotonic() < entry[1]:
        return entry[0]
    if entry:
        del _USER_CACHE[token]
    return None


def _cache_set(token: str, user: dict):
    # Evict if cache grows large (simple LRU-lite: drop oldest 20% when > 500 entries)
    if len(_USER_CACHE) >= 500:
        cutoff = time.monotonic()
        stale = [k for k, v in _USER_CACHE.items() if v[1] < cutoff]
        for k in stale:
            del _USER_CACHE[k]
        # If still too large, drop arbitrary entries
        while len(_USER_CACHE) >= 450:
            _USER_CACHE.pop(next(iter(_USER_CACHE)))
    _USER_CACHE[token] = (user, time.monotonic() + _CACHE_TTL)


def _cache_invalidate(token: str):
    _USER_CACHE.pop(token, None)


async def get_current_user(authorization: str = Header(...)):
    """
    Validates the custom JWT issued by /api/auth/mobile-login or /api/auth/web-login.
    User profile is cached in-process for 5 minutes to avoid a Firestore read
    on every request (the dominant latency source on Render free tier).
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.split("Bearer ")[1]

    # Decode JWT first (cheap, no I/O)
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        _cache_invalidate(token)
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = payload.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Cache hit — skip Firestore entirely
    cached = _cache_get(token)
    if cached is not None:
        return cached

    # Cache miss — fetch from Firestore once, then cache
    db = get_firestore()
    user_doc = db.collection("users").document(uid).get()

    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User profile not found")

    user_data = user_doc.to_dict()

    if user_data.get("status") == "inactive":
        raise HTTPException(status_code=403, detail="Account is inactive")

    result = {**user_data, "uid": uid}
    _cache_set(token, result)
    return result


def require_role(*roles):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker
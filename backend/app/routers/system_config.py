from fastapi import APIRouter, Depends
from app.models.schemas import SystemConfigUpdate
from app.firebase_init import get_firestore
from app.dependencies import require_role
from datetime import datetime, timezone

router = APIRouter()


@router.get("")
async def get_config(current_user: dict = Depends(require_role("admin", "teacher", "student"))):
    db = get_firestore()
    doc = db.collection("systemConfig").document("main").get()
    if not doc.exists:
        return {}
    data = doc.to_dict()
    if "updatedAt" in data and hasattr(data["updatedAt"], "isoformat"):
        data["updatedAt"] = data["updatedAt"].isoformat()
    return data


@router.patch("")
async def update_config(
    payload: SystemConfigUpdate,
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updatedAt"] = datetime.now(timezone.utc)
    updates["updatedBy"] = current_user["uid"]
    db.collection("systemConfig").document("main").update(updates)
    return {"message": "Config updated"}
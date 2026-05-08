from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import CreateNotificationRequest
from app.firebase_init import get_firestore
from app.dependencies import get_current_user, require_role
from datetime import datetime, timezone
import uuid

router = APIRouter()


@router.post("")
async def create_notification(
    payload: CreateNotificationRequest,
    current_user: dict = Depends(require_role("admin", "teacher")),
):
    db = get_firestore()
    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    db.collection("notifications").document(doc_id).set({
        "notificationId": doc_id,
        "title": payload.title,
        "body": payload.body,
        "targetType": payload.targetType,
        "targetValue": payload.targetValue,
        "createdAt": now,
        "createdBy": current_user["uid"],
        "readBy": [],
    })
    return {"notificationId": doc_id, "message": "Notification sent"}


@router.get("")
async def list_notifications(
    current_user: dict = Depends(get_current_user),
):
    """
    Returns all notifications. Client-side filtering by targetType/targetValue
    is applied in the frontend. This endpoint returns all so the Firestore
    real-time listener on the client can handle the logic.
    """
    db = get_firestore()
    docs = (
        db.collection("notifications")
        .order_by("createdAt", direction="DESCENDING")
        .limit(100)
        .stream()
    )
    results = []
    for doc in docs:
        data = doc.to_dict()
        if "createdAt" in data and hasattr(data["createdAt"], "isoformat"):
            data["createdAt"] = data["createdAt"].isoformat()
        results.append(data)
    return results


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    from firebase_admin import firestore as fs
    db = get_firestore()
    doc = db.collection("notifications").document(notification_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.collection("notifications").document(notification_id).update({
        "readBy": fs.ArrayUnion([current_user["uid"]])
    })
    return {"message": "Marked as read"}


@router.patch("/read-all")
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
):
    from firebase_admin import firestore as fs
    db = get_firestore()
    # Fetch notifications relevant to this user
    docs = db.collection("notifications").stream()
    batch = db.batch()
    count = 0
    uid = current_user["uid"]
    for doc in docs:
        data = doc.to_dict()
        if uid not in (data.get("readBy") or []):
            batch.update(doc.reference, {"readBy": fs.ArrayUnion([uid])})
            count += 1
            if count % 499 == 0:
                batch.commit()
                batch = db.batch()
    if count > 0:
        batch.commit()
    return {"message": f"{count} notifications marked as read"}
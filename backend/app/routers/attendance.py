from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import ManualAttendanceRequest
from app.firebase_init import get_firestore
from app.dependencies import get_current_user, require_role
from datetime import datetime, timezone

router = APIRouter()


@router.get("")
async def list_attendance(
    lecture_id: str = None,
    student_id: str = None,
    subject_id: str = None,
    status: str = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore()
    query = db.collection("attendance")

    if lecture_id:
        query = query.where("lectureId", "==", lecture_id)
    if student_id:
        query = query.where("studentId", "==", student_id)
    if subject_id:
        query = query.where("subjectId", "==", subject_id)
    if status:
        query = query.where("status", "==", status)

    docs = query.stream()
    records = []
    for doc in docs:
        data = doc.to_dict()
        for key in ["markedAt", "approvedAt"]:
            if key in data and hasattr(data[key], "isoformat"):
                data[key] = data[key].isoformat()
        records.append(data)
    return records


@router.patch("/{doc_id}/approve")
async def approve_attendance(
    doc_id: str,
    current_user: dict = Depends(require_role("teacher", "admin")),
):
    db = get_firestore()
    doc = db.collection("attendance").document(doc_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    now = datetime.now(timezone.utc)
    db.collection("attendance").document(doc_id).update({
        "status": "approved",
        "approvedBy": current_user["uid"],
        "approvedAt": now,
    })
    return {"message": "Attendance approved"}


@router.patch("/{doc_id}/reject")
async def reject_attendance(
    doc_id: str,
    current_user: dict = Depends(require_role("teacher", "admin")),
):
    db = get_firestore()
    doc = db.collection("attendance").document(doc_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    db.collection("attendance").document(doc_id).update({
        "status": "rejected",
        "approvedBy": current_user["uid"],
        "approvedAt": datetime.now(timezone.utc),
    })
    return {"message": "Attendance rejected"}


@router.post("/manual")
async def manual_attendance(
    payload: ManualAttendanceRequest,
    current_user: dict = Depends(require_role("teacher", "admin")),
):
    db = get_firestore()

    # Check manual marking is enabled
    config_doc = db.collection("systemConfig").document("main").get()
    config = config_doc.to_dict() if config_doc.exists else {}
    if not config.get("manualMarkingEnabled", False):
        raise HTTPException(status_code=403, detail="Manual marking is disabled by admin")

    # Verify lecture exists
    lecture_doc = db.collection("lectures").document(payload.lectureId).get()
    if not lecture_doc.exists:
        raise HTTPException(status_code=404, detail="Lecture not found")

    doc_id = f"{payload.lectureId}_{payload.studentId}"
    now = datetime.now(timezone.utc)

    db.collection("attendance").document(doc_id).set({
        "lectureId": payload.lectureId,
        "subjectId": payload.subjectId,
        "studentId": payload.studentId,
        "markedAt": now,
        "irisConfidence": 0.0,
        "irisImagePath": "",
        "status": "manual",
        "approvedBy": None,
        "approvedAt": None,
        "manuallyMarkedBy": current_user["uid"],
        "note": payload.note or "",
    })
    return {"message": "Attendance manually marked", "docId": doc_id}


@router.post("/approve-all")
async def approve_all(
    lecture_id: str,
    current_user: dict = Depends(require_role("teacher", "admin")),
):
    db = get_firestore()
    pending = (
        db.collection("attendance")
        .where("lectureId", "==", lecture_id)
        .where("status", "==", "pending")
        .stream()
    )
    now = datetime.now(timezone.utc)
    batch = db.batch()
    count = 0
    for doc in pending:
        batch.update(doc.reference, {
            "status": "approved",
            "approvedBy": current_user["uid"],
            "approvedAt": now,
        })
        count += 1
    if count > 0:
        batch.commit()
    return {"message": f"{count} records approved"}
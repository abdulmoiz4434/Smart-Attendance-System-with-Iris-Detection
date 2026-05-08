from fastapi import APIRouter, HTTPException, Depends
from app.firebase_init import get_firestore
from app.dependencies import require_role
from datetime import datetime, timezone
import uuid

router = APIRouter()


@router.get("")
async def list_lectures(
    subject_id: str = None,
    teacher_id: str = None,
    date: str = None,
    current_user: dict = Depends(require_role("admin", "teacher", "student"))
):
    db = get_firestore()
    query = db.collection("lectures")
    if subject_id:
        query = query.where("subjectId", "==", subject_id)
    if teacher_id:
        query = query.where("teacherId", "==", teacher_id)
    if date:
        query = query.where("scheduledDate", "==", date)

    docs = query.stream()
    lectures = []
    for doc in docs:
        data = doc.to_dict()
        for key in ["attendanceOpenedAt", "attendanceClosedAt", "createdAt"]:
            if key in data and hasattr(data[key], "isoformat"):
                data[key] = data[key].isoformat()
        lectures.append(data)
    return lectures


@router.post("")
async def create_manual_lecture(
    payload: dict,
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    lecture_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Fetch current lecture count for subject to assign lectureNumber
    existing = db.collection("lectures").where("subjectId", "==", payload["subjectId"]).stream()
    count = sum(1 for _ in existing)

    lecture_data = {
        "lectureId": lecture_id,
        "subjectId": payload["subjectId"],
        "teacherId": payload["teacherId"],
        "scheduledDate": payload["scheduledDate"],
        "startTime": payload["startTime"],
        "endTime": payload["endTime"],
        "attendanceOpen": False,
        "attendanceOpenedAt": None,
        "attendanceClosedAt": None,
        "lectureNumber": count + 1,
        "status": "scheduled",
        "isManual": True,
        "createdAt": now,
    }
    db.collection("lectures").document(lecture_id).set(lecture_data)
    return {"lectureId": lecture_id, "message": "Manual lecture created"}


@router.patch("/{lecture_id}/open")
async def open_attendance(
    lecture_id: str,
    current_user: dict = Depends(require_role("teacher", "admin"))
):
    db = get_firestore()
    doc = db.collection("lectures").document(lecture_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lecture not found")
    now = datetime.now(timezone.utc)
    db.collection("lectures").document(lecture_id).update({
        "attendanceOpen": True,
        "attendanceOpenedAt": now,
        "status": "ongoing",
    })
    return {"message": "Attendance window opened"}


@router.patch("/{lecture_id}/close")
async def close_attendance(
    lecture_id: str,
    current_user: dict = Depends(require_role("teacher", "admin"))
):
    db = get_firestore()
    doc = db.collection("lectures").document(lecture_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lecture not found")
    now = datetime.now(timezone.utc)
    db.collection("lectures").document(lecture_id).update({
        "attendanceOpen": False,
        "attendanceClosedAt": now,
        "status": "completed",
    })
    return {"message": "Attendance window closed"}


@router.patch("/{lecture_id}/check-close")
async def check_close(
    lecture_id: str,
    current_user: dict = Depends(require_role("teacher", "admin", "student"))
):
    """Auto-close if current time is past endTime."""
    db = get_firestore()
    doc = db.collection("lectures").document(lecture_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lecture not found")

    data = doc.to_dict()
    if not data.get("attendanceOpen"):
        return {"message": "Already closed"}

    end_time_str = data.get("endTime", "23:59")
    scheduled_date = data.get("scheduledDate")
    h, m = map(int, end_time_str.split(":"))
    from datetime import date as date_type
    today = date_type.today().isoformat()

    if scheduled_date == today:
        now = datetime.now(timezone.utc)
        now_local = now.replace(tzinfo=None)
        end_dt = datetime.strptime(f"{scheduled_date} {end_time_str}", "%Y-%m-%d %H:%M")
        if datetime.now() >= end_dt:
            db.collection("lectures").document(lecture_id).update({
                "attendanceOpen": False,
                "attendanceClosedAt": now,
                "status": "completed",
            })
            return {"message": "Auto-closed"}

    return {"message": "Still open"}


@router.patch("/{lecture_id}/cancel")
async def cancel_lecture(
    lecture_id: str,
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    doc = db.collection("lectures").document(lecture_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lecture not found")
    db.collection("lectures").document(lecture_id).update({"status": "cancelled"})
    return {"message": "Lecture cancelled"}
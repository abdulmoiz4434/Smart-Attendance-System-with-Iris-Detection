from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import CreateSubjectRequest
from app.firebase_init import get_firestore
from app.dependencies import require_role
from app.services.lecture_service import generate_lectures, delete_future_scheduled_lectures
from datetime import datetime, timezone
import uuid

router = APIRouter()


@router.post("")
async def create_subject(
    payload: CreateSubjectRequest,
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    subject_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    subject_data = {
        "subjectId": subject_id,
        "name": payload.name,
        "courseCode": payload.courseCode,
        "semesterLabel": payload.semesterLabel,
        "semesterStart": payload.semesterStart,
        "semesterEnd": payload.semesterEnd,
        "teacherId": payload.teacherId,
        "department": payload.department,
        "creditHours": payload.creditHours,
        "enrolledStudentIds": payload.enrolledStudentIds,
        "schedule": [s.model_dump() for s in payload.schedule],
        "createdAt": now,
        "createdBy": current_user["uid"],
    }

    db.collection("subjects").document(subject_id).set(subject_data)
    return {"subjectId": subject_id, "message": "Subject created"}


@router.get("")
async def list_subjects(current_user: dict = Depends(require_role("admin", "teacher", "student"))):
    db = get_firestore()
    docs = db.collection("subjects").stream()
    subjects = []
    for doc in docs:
        data = doc.to_dict()
        for key in ["semesterStart", "semesterEnd", "createdAt"]:
            if key in data and hasattr(data[key], "isoformat"):
                data[key] = data[key].isoformat()
        subjects.append(data)
    return subjects


@router.get("/{subject_id}")
async def get_subject(
    subject_id: str,
    current_user: dict = Depends(require_role("admin", "teacher", "student"))
):
    db = get_firestore()
    doc = db.collection("subjects").document(subject_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Subject not found")
    data = doc.to_dict()
    for key in ["semesterStart", "semesterEnd", "createdAt"]:
        if key in data and hasattr(data[key], "isoformat"):
            data[key] = data[key].isoformat()
    return data


@router.patch("/{subject_id}")
async def update_subject(
    subject_id: str,
    payload: dict,
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    doc = db.collection("subjects").document(subject_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.collection("subjects").document(subject_id).update(payload)
    return {"message": "Subject updated"}


@router.post("/{subject_id}/generate-lectures")
async def generate_subject_lectures(
    subject_id: str,
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    subject_doc = db.collection("subjects").document(subject_id).get()
    if not subject_doc.exists:
        raise HTTPException(status_code=404, detail="Subject not found")

    subject = subject_doc.to_dict()
    count = generate_lectures(db, subject_id, subject)
    return {"message": f"{count} lectures generated"}


@router.post("/{subject_id}/regenerate-future-lectures")
async def regenerate_future_lectures(
    subject_id: str,
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    subject_doc = db.collection("subjects").document(subject_id).get()
    if not subject_doc.exists:
        raise HTTPException(status_code=404, detail="Subject not found")

    subject = subject_doc.to_dict()
    deleted = delete_future_scheduled_lectures(db, subject_id)
    count = generate_lectures(db, subject_id, subject, future_only=True)
    return {"message": f"{deleted} old lectures removed, {count} new lectures generated"}


@router.patch("/{subject_id}/enroll")
async def enroll_students(
    subject_id: str,
    payload: dict,  # { "studentIds": [...] }
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    doc = db.collection("subjects").document(subject_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Subject not found")

    student_ids = payload.get("studentIds", [])
    db.collection("subjects").document(subject_id).update({
        "enrolledStudentIds": student_ids
    })
    return {"message": f"Enrolled {len(student_ids)} students"}
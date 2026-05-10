from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import IrisEnrollRequest, IrisVerifyRequest
from app.firebase_init import get_firestore
from app.dependencies import get_current_user
from app.services.iris_service import (
    compute_embedding_from_bytes,
    average_embeddings,
    cosine_similarity,
)
from app.services.firebase_service import download_image_bytes, get_student_embedding
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/enroll")
async def enroll_iris(
    payload: IrisEnrollRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Enroll a student's iris.
    Downloads 3 frames from Firebase Storage, extracts Gabor embeddings,
    averages them, and writes the result to Firestore.
    """
    # Permission check: student can only enroll themselves; admin can enroll anyone
    if current_user["role"] == "student" and current_user["uid"] != payload.studentId:
        raise HTTPException(status_code=403, detail="Cannot enroll another student")

    if len(payload.imageStoragePaths) != 3:
        raise HTTPException(status_code=400, detail="Exactly 3 image paths required")

    db = get_firestore()

    # Verify student exists
    student_doc = db.collection("students").document(payload.studentId).get()
    if not student_doc.exists:
        raise HTTPException(status_code=404, detail="Student profile not found")

    # Process each frame
    embeddings = []
    for path in payload.imageStoragePaths:
        try:
            image_bytes = download_image_bytes(path)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to download {path}: {str(e)}")

        embedding = compute_embedding_from_bytes(image_bytes)
        if embedding is None:
            raise HTTPException(status_code=422, detail=f"Could not process iris image: {path}")
        embeddings.append(embedding)

    # Average the 3 embeddings
    avg_embedding = average_embeddings(embeddings)

    # Write to Firestore
    now = datetime.now(timezone.utc)
    db.collection("students").document(payload.studentId).update({
        "irisEnrolled": True,
        "irisEmbedding": avg_embedding.tolist(),
        "irisImagePath": payload.imageStoragePaths[0],  # First frame as reference
        "irisEnrolledAt": now,
    })

    return {
        "message": "Iris enrolled successfully",
        "studentId": payload.studentId,
        "enrolledAt": now.isoformat(),
    }


@router.post("/verify")
async def verify_iris(
    payload: IrisVerifyRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Verify a student's iris for attendance.
    Compares the fresh embedding against the stored enrollment embedding.
    """
    if current_user["role"] == "student" and current_user["uid"] != payload.studentId:
        raise HTTPException(status_code=403, detail="Cannot verify another student")

    db = get_firestore()

    # Load system config for threshold
    config_doc = db.collection("systemConfig").document("main").get()
    config = config_doc.to_dict() if config_doc.exists else {}
    threshold = config.get("irisMatchThreshold", 0.80)
    max_retries = int(config.get("maxIrisRetries", 3))

    # Check lecture is open
    lecture_doc = db.collection("lectures").document(payload.lectureId).get()
    if not lecture_doc.exists:
        raise HTTPException(status_code=404, detail="Lecture not found")
    lecture = lecture_doc.to_dict()
    if lecture.get("status") in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Lecture is not accepting attendance")
    if not lecture.get("attendanceOpen"):
        raise HTTPException(status_code=400, detail="Attendance window is not open")

    # Check for existing approved attendance (no duplicate)
    doc_id = f"{payload.lectureId}_{payload.studentId}"
    existing_doc = db.collection("attendance").document(doc_id).get()
    if existing_doc.exists:
        existing = existing_doc.to_dict()
        if existing.get("status") in ("approved", "manual"):
            raise HTTPException(status_code=409, detail="Attendance already approved for this lecture")
        # Enforce retry count for re-submissions (typically after teacher rejection)
        retry_count = int(existing.get("retryCount", 0))
        if retry_count >= max_retries:
            raise HTTPException(status_code=429, detail="Maximum retries reached for this lecture")

    # Fetch stored embedding
    stored_embedding = get_student_embedding(payload.studentId)
    if not stored_embedding:
        raise HTTPException(status_code=400, detail="Student has no enrolled iris. Enroll first.")

    # Download and process the verification frame
    try:
        image_bytes = download_image_bytes(payload.imagePath)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to download image: {str(e)}")

    fresh_embedding = compute_embedding_from_bytes(image_bytes)
    if fresh_embedding is None:
        logger.warning(f"[iris/verify] No iris ROI extracted for student={payload.studentId}")
        return {
            "matched": False,
            "score": 0,
            "threshold": threshold,
            "status": "no_iris",
            "message": "No iris detected. Please face the camera and ensure good lighting.",
        }

    # Compute similarity
    score = cosine_similarity(fresh_embedding.tolist(), stored_embedding)
    matched = score >= threshold
    logger.info(f"[iris/verify] student={payload.studentId} score={score:.4f} threshold={threshold} matched={matched}")

    now = datetime.now(timezone.utc)
    if not matched:
        # Do NOT create an attendance record on mismatch — teacher rejection is handled separately.
        return {
            "matched": False,
            "score": round(score, 4),
            "threshold": threshold,
            "status": "no_match",
            "message": f"Iris did not match (score: {score:.2f}, required: {threshold}). Please retry.",
        }

    # Write attendance record as pending (overwrite if retrying)
    next_retry_count = 0
    if existing_doc.exists:
        next_retry_count = int(existing.get("retryCount", 0)) + 1

    db.collection("attendance").document(doc_id).set({
        "lectureId": payload.lectureId,
        "subjectId": lecture.get("subjectId", ""),
        "studentId": payload.studentId,
        "markedAt": now,
        "irisConfidence": round(score, 4),
        "irisImagePath": payload.imagePath,
        "status": "pending",
        "approvedBy": None,
        "approvedAt": None,
        "manuallyMarkedBy": None,
        "note": None,
        "retryCount": next_retry_count,
    })

    return {
        "matched": True,
        "score": round(score, 4),
        "threshold": threshold,
        "status": "pending",
        "message": "Iris matched. Attendance submitted for approval.",
    }
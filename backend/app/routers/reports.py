from fastapi import APIRouter, HTTPException, Depends, Response
from app.firebase_init import get_firestore
from app.dependencies import get_current_user, require_role
import csv
import io

router = APIRouter()


@router.get("/student/{uid}/subject/{subject_id}")
async def student_subject_report(
    uid: str,
    subject_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns attendance stats for one student in one subject.
    % = (approved + manual) / non-cancelled lectures × 100
    """
    # Students can only view their own; teachers and admins can view any
    if current_user["role"] == "student" and current_user["uid"] != uid:
        raise HTTPException(status_code=403, detail="Access denied")

    db = get_firestore()

    # All non-cancelled lectures for this subject
    all_lectures = (
        db.collection("lectures")
        .where("subjectId", "==", subject_id)
        .stream()
    )
    lectures = [l.to_dict() for l in all_lectures]
    # With this:
    from datetime import date as date_type
    today_str = date_type.today().isoformat()
    non_cancelled = [
        l for l in lectures
        if l.get("status") != "cancelled" and l.get("scheduledDate", "") <= today_str
    ]
    total = len(non_cancelled)

    # Attendance records for this student in this subject
    records = (
        db.collection("attendance")
        .where("studentId", "==", uid)
        .where("subjectId", "==", subject_id)
        .stream()
    )
    records_list = [r.to_dict() for r in records]

    approved = sum(1 for r in records_list if r.get("status") in ("approved", "manual"))
    pending  = sum(1 for r in records_list if r.get("status") == "pending")
    rejected = sum(1 for r in records_list if r.get("status") == "rejected")
    absent   = total - len(records_list)

    percentage = round((approved / total) * 100, 1) if total > 0 else 0.0

    # Load threshold
    config_doc = db.collection("systemConfig").document("main").get()
    config = config_doc.to_dict() if config_doc.exists else {}
    threshold = config.get("attendanceThreshold", 75)

    return {
        "studentId":   uid,
        "subjectId":   subject_id,
        "total":       total,
        "approved":    approved,
        "pending":     pending,
        "rejected":    rejected,
        "absent":      absent,
        "percentage":  percentage,
        "threshold":   threshold,
        "belowThreshold": percentage < threshold and total > 0,
    }

@router.get("/student/{uid}/all-subjects")
async def student_all_subjects_report(
    uid: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns attendance stats for all subjects a student is enrolled in.
    Single endpoint replacing N separate /student/{uid}/subject/{id} calls.
    Firestore queries run concurrently via asyncio to minimise wall-clock time.
    """
    if current_user["role"] == "student" and current_user["uid"] != uid:
        raise HTTPException(status_code=403, detail="Access denied")

    import asyncio
    from datetime import date as date_type
    from concurrent.futures import ThreadPoolExecutor

    db = get_firestore()
    today_str = date_type.today().isoformat()

    # Helper: run a blocking Firestore call in a thread so we can await it
    loop = asyncio.get_event_loop()
    executor = ThreadPoolExecutor(max_workers=8)

    def _fetch_config():
        doc = db.collection("systemConfig").document("main").get()
        cfg = doc.to_dict() if doc.exists else {}
        return cfg.get("attendanceThreshold", 75)

    def _fetch_subjects():
        docs = db.collection("subjects").stream()
        return [
            s.to_dict() for s in docs
            if uid in s.to_dict().get("enrolledStudentIds", [])
        ]

    # Run config + subjects fetch concurrently
    threshold, enrolled_subjects = await asyncio.gather(
        loop.run_in_executor(executor, _fetch_config),
        loop.run_in_executor(executor, _fetch_subjects),
    )

    if not enrolled_subjects:
        return []

    subject_ids = [s["subjectId"] for s in enrolled_subjects]

    # Build per-chunk fetch functions and run ALL chunks concurrently
    def _fetch_lectures_chunk(chunk):
        docs = db.collection("lectures").where("subjectId", "in", chunk).stream()
        return [d.to_dict() for d in docs]

    def _fetch_attendance_chunk(chunk):
        docs = (
            db.collection("attendance")
            .where("studentId", "==", uid)
            .where("subjectId", "in", chunk)
            .stream()
        )
        return [d.to_dict() for d in docs]

    chunks = [subject_ids[i:i+10] for i in range(0, len(subject_ids), 10)]

    # Fire all lecture chunks + all attendance chunks simultaneously
    lec_tasks = [loop.run_in_executor(executor, _fetch_lectures_chunk, c) for c in chunks]
    att_tasks = [loop.run_in_executor(executor, _fetch_attendance_chunk, c) for c in chunks]

    results_raw = await asyncio.gather(*lec_tasks, *att_tasks)
    mid = len(chunks)
    all_lectures  = [doc for chunk_result in results_raw[:mid] for doc in chunk_result]
    all_attendance = [doc for chunk_result in results_raw[mid:] for doc in chunk_result]

    # Group by subjectId
    lectures_by_subject: dict = {}
    for lec in all_lectures:
        lectures_by_subject.setdefault(lec["subjectId"], []).append(lec)

    attendance_by_subject: dict = {}
    for rec in all_attendance:
        attendance_by_subject.setdefault(rec["subjectId"], []).append(rec)

    output = []
    for subject in enrolled_subjects:
        sid = subject["subjectId"]
        past_lectures = [
            l for l in lectures_by_subject.get(sid, [])
            if l.get("status") != "cancelled" and l.get("scheduledDate", "") <= today_str
        ]
        total = len(past_lectures)
        records = attendance_by_subject.get(sid, [])
        approved = sum(1 for r in records if r.get("status") in ("approved", "manual"))
        pending  = sum(1 for r in records if r.get("status") == "pending")
        rejected = sum(1 for r in records if r.get("status") == "rejected")
        absent   = total - len(records)
        percentage = round((approved / total) * 100, 1) if total > 0 else 0.0

        output.append({
            "studentId":      uid,
            "subjectId":      sid,
            "total":          total,
            "approved":       approved,
            "pending":        pending,
            "rejected":       rejected,
            "absent":         absent,
            "percentage":     percentage,
            "threshold":      threshold,
            "belowThreshold": percentage < threshold and total > 0,
        })

    return output

@router.get("/subject/{subject_id}")
async def subject_report(
    subject_id: str,
    current_user: dict = Depends(require_role("admin", "teacher")),
):
    """Per-subject attendance report — all students."""
    db = get_firestore()

    subject_doc = db.collection("subjects").document(subject_id).get()
    if not subject_doc.exists:
        raise HTTPException(status_code=404, detail="Subject not found")
    subject = subject_doc.to_dict()

    enrolled_uids = subject.get("enrolledStudentIds", [])

    all_lectures = list(
        db.collection("lectures")
        .where("subjectId", "==", subject_id)
        .stream()
    )
    non_cancelled = [l.to_dict() for l in all_lectures if l.to_dict().get("status") != "cancelled"]
    total_lectures = len(non_cancelled)

    all_attendance = list(
        db.collection("attendance")
        .where("subjectId", "==", subject_id)
        .stream()
    )
    att_by_student = {}
    for doc in all_attendance:
        d = doc.to_dict()
        sid = d["studentId"]
        att_by_student.setdefault(sid, []).append(d)

    config_doc = db.collection("systemConfig").document("main").get()
    config = config_doc.to_dict() if config_doc.exists else {}
    threshold = config.get("attendanceThreshold", 75)

    rows = []
    for uid in enrolled_uids:
        recs = att_by_student.get(uid, [])
        approved = sum(1 for r in recs if r.get("status") in ("approved", "manual"))
        pct = round((approved / total_lectures) * 100, 1) if total_lectures > 0 else 0.0
        rows.append({
            "studentId":      uid,
            "approved":       approved,
            "totalLectures":  total_lectures,
            "percentage":     pct,
            "belowThreshold": pct < threshold and total_lectures > 0,
        })

    rows.sort(key=lambda r: r["percentage"])

    return {
        "subjectId":     subject_id,
        "subjectName":   subject.get("name"),
        "courseCode":    subject.get("courseCode"),
        "totalLectures": total_lectures,
        "threshold":     threshold,
        "students":      rows,
    }


@router.get("/export/csv")
async def export_csv(
    subject_id: str = None,
    student_id: str = None,
    current_user: dict = Depends(require_role("admin", "teacher")),
):
    """Export attendance records as CSV."""
    db = get_firestore()
    query = db.collection("attendance")
    if subject_id:
        query = query.where("subjectId", "==", subject_id)
    if student_id:
        query = query.where("studentId", "==", student_id)

    docs = list(query.stream())

    # Enrich with names
    user_cache = {}
    subject_cache = {}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Student ID", "Student Name", "Subject", "Course Code",
        "Lecture ID", "Date", "Status", "Confidence", "Marked At"
    ])

    for doc in docs:
        d = doc.to_dict()
        sid = d.get("studentId", "")
        subid = d.get("subjectId", "")

        if sid not in user_cache:
            u = db.collection("users").document(sid).get()
            user_cache[sid] = u.to_dict().get("fullName", sid) if u.exists else sid
        if subid not in subject_cache:
            s = db.collection("subjects").document(subid).get()
            subject_cache[subid] = s.to_dict() if s.exists else {}

        sub = subject_cache[subid]
        marked_at = d.get("markedAt")
        marked_str = marked_at.isoformat() if hasattr(marked_at, "isoformat") else str(marked_at)

        # Get lecture date
        lid = d.get("lectureId", "")
        lec = db.collection("lectures").document(lid).get()
        lec_date = lec.to_dict().get("scheduledDate", "") if lec.exists else ""

        writer.writerow([
            sid,
            user_cache[sid],
            sub.get("name", subid),
            sub.get("courseCode", ""),
            lid,
            lec_date,
            d.get("status", ""),
            d.get("irisConfidence", ""),
            marked_str,
        ])

    csv_bytes = output.getvalue().encode("utf-8")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_export.csv"},
    )
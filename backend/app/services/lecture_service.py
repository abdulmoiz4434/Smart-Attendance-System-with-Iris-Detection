from datetime import date, timedelta, datetime, timezone
from typing import List
import uuid

WEEKDAY_MAP = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2,
    "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6
}


def generate_lectures(db, subject_id: str, subject: dict, future_only: bool = False) -> int:
    """
    Iterates the semester date range and batch-writes lecture documents.
    Returns count of lectures created.
    """
    start_str = subject["semesterStart"]
    end_str = subject["semesterEnd"]
    schedule = subject.get("schedule", [])  # [{ day, startTime, endTime }]
    teacher_id = subject["teacherId"]

    start_date = date.fromisoformat(start_str)
    end_date = date.fromisoformat(end_str)
    today = date.today()

    # Build a map: weekday_int -> list of { startTime, endTime }
    day_slots = {}
    for slot in schedule:
        day_int = WEEKDAY_MAP.get(slot["day"])
        if day_int is not None:
            day_slots.setdefault(day_int, []).append(slot)

    # Count existing lectures to assign sequential numbers
    existing_docs = db.collection("lectures").where("subjectId", "==", subject_id).stream()
    lecture_number = sum(1 for _ in existing_docs)

    batch = db.batch()
    count = 0
    current = start_date

    while current <= end_date:
        if future_only and current <= today:
            current += timedelta(days=1)
            continue

        weekday = current.weekday()
        if weekday in day_slots:
            for slot in day_slots[weekday]:
                lecture_id = str(uuid.uuid4())
                lecture_number += 1
                ref = db.collection("lectures").document(lecture_id)
                batch.set(ref, {
                    "lectureId": lecture_id,
                    "subjectId": subject_id,
                    "teacherId": teacher_id,
                    "scheduledDate": current.isoformat(),
                    "startTime": slot["startTime"],
                    "endTime": slot["endTime"],
                    "attendanceOpen": False,
                    "attendanceOpenedAt": None,
                    "attendanceClosedAt": None,
                    "lectureNumber": lecture_number,
                    "status": "scheduled",
                    "isManual": False,
                    "createdAt": datetime.now(timezone.utc),
                })
                count += 1

                # Firestore batch limit is 500
                if count % 499 == 0:
                    batch.commit()
                    batch = db.batch()

        current += timedelta(days=1)

    if count % 499 != 0:
        batch.commit()

    return count


def delete_future_scheduled_lectures(db, subject_id: str) -> int:
    """Delete all future lectures with status 'scheduled' for a subject."""
    today = date.today().isoformat()
    docs = (
        db.collection("lectures")
        .where("subjectId", "==", subject_id)
        .where("status", "==", "scheduled")
        .stream()
    )
    batch = db.batch()
    count = 0
    for doc in docs:
        data = doc.to_dict()
        if data.get("scheduledDate", "") > today:
            batch.delete(doc.reference)
            count += 1
            if count % 499 == 0:
                batch.commit()
                batch = db.batch()

    if count > 0:
        batch.commit()
    return count
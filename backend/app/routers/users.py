from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import CreateUserRequest, UpdateUserRequest
from app.firebase_init import get_auth, get_firestore
from app.dependencies import get_current_user, require_role
from datetime import datetime, timezone
import uuid

router = APIRouter()

@router.post("/users")
async def create_user(
    payload: CreateUserRequest,
    current_user: dict = Depends(require_role("admin"))
):
    firebase_auth = get_auth()
    db = get_firestore()

    # 1. Create Firebase Auth user
    try:
        firebase_user = firebase_auth.create_user(
            email=payload.email,
            password=payload.password,
            display_name=payload.fullName,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Firebase Auth error: {str(e)}")

    uid = firebase_user.uid
    now = datetime.now(timezone.utc)

    # 2. Write to users/{uid}
    user_doc = {
        "uid": uid,
        "role": payload.role,
        "email": payload.email,
        "fullName": payload.fullName,
        "cnic": payload.cnic,
        "dateOfBirth": payload.dateOfBirth,
        "phone": payload.phone or "",
        "status": "active",
        "createdAt": now,
        "createdBy": current_user["uid"],
    }
    db.collection("users").document(uid).set(user_doc)

    # 3. Write role-specific doc
    if payload.role == "student":
        if not payload.registrationId:
            raise HTTPException(status_code=400, detail="registrationId required for student")
        db.collection("students").document(uid).set({
            "registrationId": payload.registrationId,
            "fatherName": payload.fatherName or "",
            "program": payload.program or "",
            "irisEnrolled": False,
            "irisEmbedding": [],
            "irisImagePath": "",
            "irisEnrolledAt": None,
        })
    elif payload.role == "teacher":
        if not payload.employeeId:
            raise HTTPException(status_code=400, detail="employeeId required for teacher")
        db.collection("teachers").document(uid).set({
            "employeeId": payload.employeeId,
            "department": payload.department or "",
        })

    return {"uid": uid, "message": "User created successfully"}


@router.get("/users")
async def list_users(
    role: str = None,
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    query = db.collection("users")
    if role:
        query = query.where("role", "==", role)
    docs = query.stream()
    users = []
    for doc in docs:
        data = doc.to_dict()
        # Convert timestamps to ISO strings for JSON serialisation
        for key in ["createdAt", "dateOfBirth"]:
            if key in data and hasattr(data[key], "isoformat"):
                data[key] = data[key].isoformat()
        users.append(data)
    return users


@router.get("/users/{uid}")
async def get_user(
    uid: str,
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    data = user_doc.to_dict()
    for key in ["createdAt", "dateOfBirth"]:
        if key in data and hasattr(data[key], "isoformat"):
            data[key] = data[key].isoformat()

    # Attach role-specific data
    role = data.get("role")
    if role in ("student", "teacher"):
        collection = "students" if role == "student" else "teachers"
        role_doc = db.collection(collection).document(uid).get()
        if role_doc.exists:
            data["roleData"] = role_doc.to_dict()

    return data


@router.patch("/users/{uid}")
async def update_user(
    uid: str,
    payload: UpdateUserRequest,
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        db.collection("users").document(uid).update(updates)

    # If deactivating, also disable in Firebase Auth
    if payload.status == "inactive":
        get_auth().update_user(uid, disabled=True)
    elif payload.status == "active":
        get_auth().update_user(uid, disabled=False)

    return {"message": "User updated"}


@router.delete("/users/{uid}")
async def deactivate_user(
    uid: str,
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    db.collection("users").document(uid).update({"status": "inactive"})
    get_auth().update_user(uid, disabled=True)
    return {"message": "User deactivated"}


@router.post("/users/{uid}/reset-iris")
async def reset_iris(
    uid: str,
    current_user: dict = Depends(require_role("admin"))
):
    db = get_firestore()
    student_doc = db.collection("students").document(uid).get()
    if not student_doc.exists:
        raise HTTPException(status_code=404, detail="Student not found")

    db.collection("students").document(uid).update({
        "irisEnrolled": False,
        "irisEmbedding": [],
        "irisImagePath": "",
        "irisEnrolledAt": None,
    })
    return {"message": "Iris reset. Student must re-enroll on next login."}
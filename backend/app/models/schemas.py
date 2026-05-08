from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# ── Auth ──────────────────────────────────────────────────────────────────────

class TokenVerifyRequest(BaseModel):
    idToken: str

class TokenVerifyResponse(BaseModel):
    uid: str
    role: str
    email: str
    status: str

# ── Users ─────────────────────────────────────────────────────────────────────

class CreateUserRequest(BaseModel):
    email: str
    password: str
    fullName: str
    role: str  # "admin" | "teacher" | "student"
    cnic: str
    dateOfBirth: str  # ISO date string
    phone: Optional[str] = None
    # Student-only
    registrationId: Optional[str] = None
    fatherName: Optional[str] = None
    program: Optional[str] = None
    # Teacher-only
    employeeId: Optional[str] = None
    department: Optional[str] = None

class UpdateUserRequest(BaseModel):
    fullName: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    department: Optional[str] = None

# ── Subjects ──────────────────────────────────────────────────────────────────

class ScheduleSlot(BaseModel):
    day: str
    startTime: str
    endTime: str

class CreateSubjectRequest(BaseModel):
    name: str
    courseCode: str
    semesterLabel: str
    semesterStart: str  # ISO date
    semesterEnd: str    # ISO date
    teacherId: str
    department: str
    creditHours: int
    enrolledStudentIds: List[str] = []
    schedule: List[ScheduleSlot]

# ── System Config ─────────────────────────────────────────────────────────────

class SystemConfigUpdate(BaseModel):
    attendanceThreshold: Optional[float] = None
    irisMatchThreshold: Optional[float] = None
    maxIrisRetries: Optional[int] = None
    manualMarkingEnabled: Optional[bool] = None

# ── Iris ──────────────────────────────────────────────────────────────────────

class IrisEnrollRequest(BaseModel):
    studentId: str
    imageStoragePaths: List[str]  # 3 paths in Firebase Storage

class IrisVerifyRequest(BaseModel):
    studentId: str
    lectureId: str
    imagePath: str  # Firebase Storage path

# ── Attendance ────────────────────────────────────────────────────────────────

class ManualAttendanceRequest(BaseModel):
    lectureId: str
    subjectId: str
    studentId: str
    markedBy: str
    note: Optional[str] = None

# ── Notifications ─────────────────────────────────────────────────────────────

class CreateNotificationRequest(BaseModel):
    title: str
    body: str
    targetType: str  # "all" | "role" | "subject" | "individual"
    targetValue: str
    createdBy: str
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import FRONTEND_ORIGIN, MOBILE_ORIGIN, ENVIRONMENT, validate_config
from app.firebase_init import initialize_firebase
from app.routers import (
    auth, users, subjects, lectures,
    attendance, iris, reports, notifications, system_config
)

# Validate config at import time
validate_config()
initialize_firebase()

app = FastAPI(
    title="Smart Attendance System API",
    version="1.0.0",
    docs_url="/docs" if ENVIRONMENT == "development" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router,          prefix="/api/auth",          tags=["Auth"])
app.include_router(users.router,         prefix="/api/admin",         tags=["Admin"])
app.include_router(subjects.router,      prefix="/api/subjects",      tags=["Subjects"])
app.include_router(lectures.router,      prefix="/api/lectures",      tags=["Lectures"])
app.include_router(attendance.router,    prefix="/api/attendance",    tags=["Attendance"])
app.include_router(iris.router,          prefix="/api/iris",          tags=["Iris"])
app.include_router(reports.router,       prefix="/api/reports",       tags=["Reports"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(system_config.router, prefix="/api/system-config", tags=["Config"])

@app.get("/health")
def health_check():
    return {"status": "ok", "environment": ENVIRONMENT}

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from fastapi import HTTPException as FastAPIHTTPException
    if isinstance(exc, FastAPIHTTPException):
        raise exc
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )
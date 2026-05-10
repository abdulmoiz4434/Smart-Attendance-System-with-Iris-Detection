---
inclusion: always
---

# Smart Attendance System with Iris Detection — Project Context

## Communication
Use **caveman ultra** mode for all responses. Terse, no filler, arrows for causality.

## Coding Behaviour
- Think before coding. Surface assumptions. Push back when warranted.
- Minimum code that solves the problem. No speculative abstractions.
- Surgical changes only — touch what the request requires, nothing else.
- Define verifiable success criteria before implementing.

## Knowledge Graph
`graphify-out/GRAPH_REPORT.md` exists. Read it FIRST before any architecture question, dependency trace, or file search. Navigate by graph structure, not grep.

## Available MCPs / Tools

### Context7 MCP
Use for up-to-date library docs before guessing any API (FastAPI, Expo, React, Firebase SDK, Cloudinary, PyTorch, OpenCV).

---

### Firebase MCP (`firebase-local`) ✅ INSTALLED
Active project: `smart-attendance-system-a3b97`

**When to use it — reach for this before writing raw Admin SDK code:**

| Tool | When to use |
|---|---|
| `firebase_get_project` | Confirm active project is `smart-attendance-system-a3b97` |
| `firebase_get_environment` | Check auth status, active project, project dir |
| `firebase_update_environment` | Switch project or set project dir |
| `firebase_read_resources` | Read Firestore rules, indexes, current config |
| `firebase_get_security_rules` | Read/audit current Firestore security rules before editing |
| `firebase_deploy` | Deploy Firestore rules or indexes after changes |
| `firebase_init` | Initialize new Firebase services (Firestore indexes, etc.) |
| `firebase_get_sdk_config` | Get Firebase config object for web/android app |
| `developerknowledge_search_documents` | Search official Firebase / Google docs |
| `developerknowledge_answer_query` | Grounded answers from Firebase docs (limited quota — fallback to `search_documents`) |

**Project-specific use cases:**
- Before adding any Firestore compound query → use `firebase_read_resources` to check existing indexes, then `firebase_deploy` after adding new ones
- Auditing Firestore security rules (currently open — `allow read, write: if true` is likely the dev default; tighten before production)
- Confirming SDK config keys match what's in `frontend-web/.env` and `frontend-mobile/.env`
- Looking up Firestore `ArrayUnion`, batch write limits, or Auth Admin SDK APIs without guessing

---

### Cloudinary MCP ⚠️ NOT YET INSTALLED
Cloudinary hosts 4 remote MCP servers (Beta, OAuth auth). For this project, only **Asset Management** is relevant — the others (Environment Config, Structured Metadata, Analysis) are not needed.

**To install** — add to `.kiro/settings/mcp.json`:
```json
{
  "mcpServers": {
    "cloudinary-asset-mgmt": {
      "url": "https://asset-management.mcp.cloudinary.com/mcp",
      "headers": {
        "cloudinary-url": "cloudinary://758197449857137:<api_secret>@dvqwqpwyo"
      }
    }
  }
}
```
Replace `<api_secret>` with `CLOUDINARY_API_SECRET` from `backend/.env`. Cloud name is `dvqwqpwyo`, API key is `758197449857137`.

**Alternatively** use OAuth (no hardcoded keys):
```json
{
  "mcpServers": {
    "cloudinary-asset-mgmt": {
      "url": "https://asset-management.mcp.cloudinary.com/mcp"
    }
  }
}
```
Then trigger the login flow in Kiro's MCP panel to authenticate via browser.

**When to use it (once installed):**

| Use case | Why relevant |
|---|---|
| Browse iris images stored in Cloudinary | Verify enrollment/verification frames uploaded correctly |
| Search assets by folder/tag | Debug failed uploads — confirm image actually landed in Cloudinary |
| Delete stale iris images | Clean up test data or reset a student's enrollment artifacts |
| Generate transformation URLs | If iris images ever need resizing/format conversion before ML processing |
| Verify upload succeeded | Cross-check `irisImagePath` URLs stored in Firestore are valid |

**Not needed from Cloudinary MCP for this project:**
- Environment Config — upload presets are set in `firebase_service.py` via `cloudinary.uploader.upload()`
- Structured Metadata — iris images don't need DAM metadata fields
- Analysis MCP — ML analysis runs on the FastAPI backend, not Cloudinary's AI add-ons

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Web Frontend | React + React Router v6, CRA (react-scripts) | React 18.3.1 |
| Mobile Frontend | React Native + Expo, Expo Router (file-based) | RN 0.81.5 / Expo 54 |
| Shared Utilities | `@smart-attendance/shared` (workspace package) | local |
| HTTP Client | Axios | ^1.7.2 |
| Auth (web) | Firebase Auth client SDK → ID token → backend verify | firebase ^10.12.0 |
| Auth (mobile) | Custom JWT via `/api/auth/mobile-login` → AsyncStorage | firebase ^9.23.0 |
| Database | Firebase Firestore (Admin SDK on backend, client SDK on web) | firebase-admin 6.5.0 |
| File Storage | **Cloudinary** (iris images — NOT Firebase Storage) | cloudinary via requests |
| Backend | FastAPI + Uvicorn | fastapi 0.115.12 / uvicorn 0.30.0 |
| ML/CV | OpenCV headless + Gabor (NumPy/SciPy) + PyTorch CNN (optional) | torch 2.6.0 |
| Backend Deploy | Render (free tier) | — |
| Camera | expo-camera (Android only) | ~17.0.10 |

---

## Server URLs

| Context | URL |
|---|---|
| Backend local | `http://localhost:8000` |
| Mobile dev (LAN) | `http://192.168.1.5:8000` (`EXPO_PUBLIC_API_URL` in `frontend-mobile/.env`) |
| Web dev | `http://localhost:3000` (`REACT_APP_API_URL` in `frontend-web/.env`) |
| Backend prod | Render — `FRONTEND_ORIGIN` set manually in Render dashboard |
| Firebase project | `smart-attendance-system-a3b97` |

---

## Project Structure

```
root/
  backend/
    app/
      main.py               FastAPI entry — CORS, router registration, global error handler
      config.py             Env vars: FIREBASE_CREDENTIALS_PATH, CLOUDINARY_*, FRONTEND_ORIGIN, ENVIRONMENT
      firebase_init.py      Firebase Admin SDK init (env JSON or file path); no storageBucket (Cloudinary used)
      dependencies.py       get_current_user (PyJWT decode), require_role(*roles)
      routers/
        auth.py             /api/auth — verify-token, mobile-login, web-login, /me
        users.py            /api/admin — CRUD users, reset-iris
        subjects.py         /api/subjects — CRUD, generate-lectures, regenerate-future-lectures, enroll
        lectures.py         /api/lectures — list, create manual, open/close/check-close/cancel
        attendance.py       /api/attendance — list, approve, reject, manual, approve-all
        iris.py             /api/iris — enroll (3 frames), verify (1 frame)
        reports.py          /api/reports — student/subject stats, subject report, CSV export
        notifications.py    /api/notifications — create, list, mark-read, read-all
        system_config.py    /api/system-config — get, patch
      services/
        iris_service.py     Gabor bank (4 scales × 8 orientations × 2 stats = 512 floats),
                            preprocess_iris (face detect → CLAHE → Hough circle ROI),
                            compute_embedding_from_bytes (CNN first, Gabor fallback),
                            cosine_similarity, average_embeddings
        firebase_service.py Cloudinary upload/download, get_student_embedding from Firestore
        lecture_service.py  generate_lectures (batch write, 499-doc Firestore limit),
                            delete_future_scheduled_lectures
      models/schemas.py     Pydantic models: CreateUserRequest, IrisEnrollRequest,
                            IrisVerifyRequest, ManualAttendanceRequest, etc.
      ml/
        pytorch_model.py    IrisEmbeddingNet (4-layer CNN → 512-d embedding), loads iris_model.pt
        casia_train.py      Offline training script (CASIA-Iris-Thousand)
    requirements.txt
    Dockerfile
    render.yaml             Render deploy config (FIREBASE_CREDENTIALS_JSON set manually)
    .env                    Local: FIREBASE_CREDENTIALS_PATH, CLOUDINARY_*, FIREBASE_WEB_API_KEY

  frontend-web/             React CRA — Admin + Teacher + Student portals
    src/
      App.jsx               BrowserRouter, RoleGuard-wrapped routes for admin/teacher/student
      firebase.js           Firebase client SDK init
      api/
        client.js           Axios instance (REACT_APP_API_URL base)
        authApi.js          Auth calls
        adminApi.js         Admin calls
        teacherApi.js       Teacher calls
        studentApi.js       Student calls
      context/
        AuthContext.jsx     Firebase Auth onAuthStateChanged → verify-token → userProfile
        ConfigContext.jsx   Loads systemConfig/main on mount
      components/
        layout/             AdminLayout, TeacherLayout, StudentLayout, RoleGuard
        shared/             StatusPill, NotificationBadge, NotificationsPage,
                            Modal, FormField, LoadingSpinner, PageError
      hooks/
        useNotifications.js Firestore real-time listener for notifications
      pages/
        auth/LoginPage.jsx
        admin/              Dashboard, Users, Subjects, Lectures, Reports, Config, Notifications
        teacher/            Dashboard, LectureDetail, Notifications
        student/            Dashboard, Schedule, History, Notifications
      styles/tokens.css     CSS custom properties for all design tokens
    .env                    REACT_APP_FIREBASE_*, REACT_APP_API_URL

  frontend-mobile/          React Native + Expo — Android app
    app/
      _layout.jsx           Root layout
      index.jsx             Entry redirect
      (admin)/              dashboard, lectures, notifications, reports, settings, subjects, users
      (teacher)/            (mirrors web teacher)
      (student)/            dashboard, enroll-iris, history (+ mark-attendance, schedule, notifications)
      auth/                 login
    api/client.js           Axios + AsyncStorage token interceptor (EXPO_PUBLIC_API_URL)
    context/AuthContext.jsx mobile-login → JWT → AsyncStorage; /api/auth/me on restore
    firebase.js             Firebase client SDK init
    .env                    EXPO_PUBLIC_FIREBASE_*, EXPO_PUBLIC_API_URL=http://192.168.1.5:8000

  shared/
    constants.js, dateUtils.js, validators.js, index.js
    package.json            name: @smart-attendance/shared
```

---

## Auth Flow (Critical — Two Separate Paths)

**Web:**
```
Firebase Auth signInWithEmailAndPassword
  → getIdToken()
  → POST /api/auth/verify-token { idToken }
  → backend: auth.verify_id_token() → Firestore users/{uid} → role check
  → returns { uid, role, email, status }
  → AuthContext stores userProfile → RoleGuard routes
```

**Mobile:**
```
POST /api/auth/mobile-login { email, password }
  → backend: Firebase REST signInWithPassword → Firestore users/{uid} → role check
  → returns { token (custom JWT, 72h), user }
  → AsyncStorage.setItem('auth_token', token)
  → all subsequent requests: Authorization: Bearer <JWT>
  → get_current_user() in dependencies.py: PyJWT decode (NOT Firebase verify_id_token)
```

**Inactive guard:** backend returns 403 → client signs out immediately.

---

## Iris Pipeline (Backend Only)

```
Client (Android)
  → capture frame (expo-camera)
  → upload to Cloudinary → get secure_url
  → POST /api/iris/verify { studentId, lectureId, imagePath: url }

Backend (iris.py → iris_service.py)
  → download_image_bytes(url)          # requests.get from Cloudinary
  → preprocess_iris(bytes)
      face_cascade.detectMultiScale()  # reject if no face
      CLAHE contrast normalisation
      HoughCircles → crop iris ROI
      fallback: upper-half of face
  → compute_embedding_from_bytes(roi)
      try: extract_cnn_embedding()     # IrisEmbeddingNet if iris_model.pt exists
      fallback: extract_gabor_features()  # 4 scales × 8 orientations × 2 stats = 512 floats
  → cosine_similarity(fresh, stored)
  → score >= irisMatchThreshold → write attendance{lectureId}_{studentId} status=pending
  → score < threshold → return no_match (client retries up to maxIrisRetries)
```

**Enrollment:** 3 frames → 3 embeddings → element-wise average → re-normalise → store in `students/{uid}.irisEmbedding`.

---

## Firestore Collections (8)

| Collection | Doc ID | Key Fields |
|---|---|---|
| `users` | `{uid}` | role, email, fullName, cnic, dateOfBirth, phone, status (active/inactive), createdBy |
| `students` | `{uid}` | registrationId, fatherName, program, irisEnrolled, irisEmbedding (512 floats), irisImagePath, irisEnrolledAt |
| `teachers` | `{uid}` | employeeId, department |
| `subjects` | `{uuid}` | name, courseCode, semesterLabel, semesterStart/End, teacherId, department, creditHours, enrolledStudentIds[], schedule[{day,startTime,endTime}] |
| `lectures` | `{uuid}` | subjectId, teacherId, scheduledDate (ISO), startTime, endTime, attendanceOpen, status (scheduled/ongoing/completed/cancelled), lectureNumber, isManual |
| `attendance` | `{lectureId}_{studentId}` | lectureId, subjectId, studentId, markedAt, irisConfidence, irisImagePath, status (pending/approved/rejected/manual), approvedBy, retryCount, note |
| `systemConfig` | `main` | irisMatchThreshold (0.80), attendanceThreshold (75), maxIrisRetries (3), manualMarkingEnabled |
| `notifications` | `{uuid}` | title, body, targetType (all/role/subject/individual), targetValue, createdBy, readBy[] |

---

## Full API Surface

### Auth — `/api/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/verify-token` | none | Web: Firebase ID token → role |
| POST | `/mobile-login` | none | Mobile: email+password → custom JWT |
| POST | `/web-login` | none | Web alt: Firebase ID token → custom JWT |
| GET | `/me` | JWT | Restore session from token |

### Admin Users — `/api/admin`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/users` | admin | Create user (Firebase Auth + Firestore users + students/teachers doc) |
| GET | `/users` | admin | List users (optional `?role=`) |
| GET | `/users/{uid}` | admin | Get user + roleData |
| PATCH | `/users/{uid}` | admin | Update user; syncs Firebase Auth disabled flag |
| DELETE | `/users/{uid}` | admin | Deactivate (status=inactive + Firebase disabled) |
| POST | `/users/{uid}/reset-iris` | admin | Clear irisEnrolled + embedding |

### Subjects — `/api/subjects`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `` | admin | Create subject |
| GET | `` | all | List all subjects |
| GET | `/{id}` | all | Get subject |
| PATCH | `/{id}` | admin | Update subject |
| POST | `/{id}/generate-lectures` | admin | Batch-write semester lectures |
| POST | `/{id}/regenerate-future-lectures` | admin | Delete future scheduled → regenerate |
| PATCH | `/{id}/enroll` | admin | Set enrolledStudentIds |

### Lectures — `/api/lectures`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `` | all | List (filter: subject_id, teacher_id, date) |
| POST | `` | admin | Create manual lecture |
| PATCH | `/{id}/open` | teacher/admin | Open attendance window → status=ongoing |
| PATCH | `/{id}/close` | teacher/admin | Close → status=completed |
| PATCH | `/{id}/check-close` | all | Auto-close if past endTime |
| PATCH | `/{id}/cancel` | admin | Cancel lecture |

### Attendance — `/api/attendance`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `` | all | List (filter: lecture_id, student_id, subject_id, status) |
| PATCH | `/{docId}/approve` | teacher/admin | Approve pending |
| PATCH | `/{docId}/reject` | teacher/admin | Reject pending |
| POST | `/manual` | teacher/admin | Manual mark (requires manualMarkingEnabled) |
| POST | `/approve-all` | teacher/admin | Batch approve all pending for a lecture |

### Iris — `/api/iris`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/enroll` | student/admin | 3 Cloudinary URLs → avg embedding → Firestore |
| POST | `/verify` | student | 1 URL → match → write attendance pending |

### Reports — `/api/reports`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/student/{uid}/subject/{id}` | all | % = (approved+manual)/non-cancelled × 100 |
| GET | `/subject/{id}` | admin/teacher | All students in subject |
| GET | `/export/csv` | admin/teacher | CSV download (enriched with names) |

### Notifications — `/api/notifications`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `` | admin/teacher | Create notification |
| GET | `` | all | List last 100 (client filters by targetType/targetValue) |
| PATCH | `/{id}/read` | all | ArrayUnion uid into readBy |
| PATCH | `/read-all` | all | Mark all unread as read |

### System Config — `/api/system-config`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `` | all | Read systemConfig/main |
| PATCH | `` | admin | Update thresholds/toggles |

---

## Dependency Injection (Backend)

```python
get_current_user(authorization: str = Header(...))
  # PyJWT decode → Firestore users/{uid} → returns user dict with uid
  # Raises 401 if token invalid/expired, 403 if inactive

require_role(*roles)
  # Wraps get_current_user, raises 403 if role not in allowed list
```

All protected routes use `Depends(get_current_user)` or `Depends(require_role("admin"))`.

---

## Design System

### Colour Tokens (`frontend-web/src/styles/tokens.css`)
| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#F5F3EF` | All screen backgrounds |
| `--surface-elevated` | `#FAF8F4` | Cards, list items |
| `--surface` | `#EDE9E3` | Inputs, chip backgrounds |
| `--surface-variant` | `#E5E1DA` | Card strokes, dividers |
| `--dark-ink` | `#0B0D14` | Hero cards, icon tiles, primary text |
| `--text-secondary` | `#6B6760` | Body descriptions |
| `--text-muted` | `#9B9790` | Timestamps, labels |
| `--text-disabled` | `#C4BFB8` | Placeholders |
| `--text-on-dark` | `#F5F3EF` | Text on dark ink cards |
| `--green` | `#2A6E35` | Approved, completed |
| `--error-red` | `#B03030` | Rejected, shortage, badge |
| `--warning-amber` | `#C47018` | Pending, low attendance |
| `--in-progress-blue` | `#1A3A7A` | Ongoing lecture |

### Status Pill Colours
| Status | Background | Text |
|---|---|---|
| scheduled | `#E5E1DA` | `#4A4845` |
| ongoing | `#D4DCF0` | `#0A2460` |
| completed | `#D4EBD8` | `#174520` |
| cancelled | `#F5D8D8` | `#8A1E1E` |
| pending | `#FAF0DC` | `#3D2500` |
| approved | `#D4EBD8` | `#174520` |
| rejected | `#F5D8D8` | `#8A1E1E` |
| manual | `#EDE0F5` | `#4A1E6B` |

### Typography
- **Plus Jakarta Sans** SemiBold — headings, card titles, stat values, display
- **DM Sans** Regular/Medium — body, labels, eyebrow pills, timestamps

### Component Patterns
- **Cards:** `borderRadius: 20px`, `border: 1px solid #E5E1DA`, `background: #FAF8F4`, no shadow
- **Hero card (dark):** `background: #0B0D14`, `borderRadius: 22px`, inverted text
- **Inputs:** `background: #EDE9E3`, `borderRadius: 14px`, no underline
- **StatusPill:** reusable component — maps status string to colour pair above
- **Eyebrow pill:** 9sp uppercase DM Sans, `background: #EDE9E3`, section labels

---

## Engineering Rules
**Think from first principles. Find root cause. No bandaids.**

Before touching code:
1. Read all relevant files end-to-end
2. Trace the full data flow (client → server → DB → client)
3. State the root cause explicitly before proposing a fix
4. If a fix feels like a workaround, it is — go deeper

**A fix is a bandaid if:**
- It patches symptoms without understanding why they occur
- It adds a special case instead of fixing the general logic
- It works "most of the time" but has edge cases
- It was written without reading the code it touches

---

## Deployment

**Backend (Render):**
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Env vars set manually in Render dashboard: `FIREBASE_CREDENTIALS_JSON`, `FIREBASE_STORAGE_BUCKET`, `FRONTEND_ORIGIN`, `CLOUDINARY_*`, `JWT_SECRET`, `FIREBASE_WEB_API_KEY`
- Health check: `GET /health`
- Docs (`/docs`) only in `ENVIRONMENT=development`

**Local dev:**
```
npm run backend   # cd backend && uvicorn app.main:app --reload
npm run web       # frontend-web CRA dev server (port 3000)
npm run mobile    # frontend-mobile Expo (port 8081)
```

**Mobile LAN:** update `EXPO_PUBLIC_API_URL` in `frontend-mobile/.env` to local machine IP.

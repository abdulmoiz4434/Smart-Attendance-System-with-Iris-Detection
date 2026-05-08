# Smart Attendance System with Iris Detection — Project Plan
> React (Web) + React Native (Android) · FastAPI Backend · Firebase · FYDP

---

## 1. System Overview

The frontend is split into two apps: React for web and React Native + Expo for Android. All ML/CV runs on a FastAPI backend — the client apps only capture and upload frames. Firebase provides auth and Firestore for storage, both on the free Spark tier. Firebase Storage holds iris images.

**Three roles:**
- **Admin** — creates all accounts, manages subjects and schedules, configures the system, sends notifications
- **Teacher** — runs lectures, opens/closes attendance windows, approves student submissions
- **Student** — enrolls iris on first login (Android), marks attendance via scan, views schedule and history

All roles share one `users` collection. Role field drives routing from the moment of login.

**Key architectural decisions:**
- React (web) and React Native + Expo (Android) share maximum logic via a shared JS utilities layer
- All ML/CV (iris preprocessing, Gabor feature extraction, PyTorch inference) runs on the FastAPI backend — no on-device model
- Firebase Auth handles authentication; Firestore stores user profiles and embeddings; Firebase Storage holds raw iris images
- Iris capture is Android-only (`expo-camera`); web students see a notice directing them to the Android app
- Backend deployed on Render free tier

---

## 2. Data Models (Firestore — 7 Collections)

### 2.1 `users/{uid}`

| Field | Type | Notes |
|---|---|---|
| uid | string | Firebase Auth UID |
| role | string | `"admin"` \| `"teacher"` \| `"student"` |
| email | string | |
| fullName | string | |
| cnic | string | 13-digit, no dashes |
| dateOfBirth | timestamp | |
| phone | string | Optional |
| status | string | `"active"` \| `"inactive"` |
| createdAt | timestamp | |
| createdBy | string | Admin UID |

`status: "inactive"` blocks access. After Firebase Auth sign-in, the backend returns `403` and the client signs the user out immediately.

---

### 2.2 `students/{uid}`

| Field | Type | Notes |
|---|---|---|
| registrationId | string | e.g. `BS-CS-F24-045`, unique |
| fatherName | string | |
| program | string | e.g. `"BS Computer Science"` |
| irisEnrolled | bool | `false` until enrollment done |
| irisEmbedding | number[] | 512 floats (Gabor feature vector) |
| irisImagePath | string | Firebase Storage path to enrolled iris image |
| irisEnrolledAt | timestamp \| null | |

Subject enrollment is stored on the subject (`enrolledStudentIds`), not here.

---

### 2.3 `teachers/{uid}`

| Field | Type | Notes |
|---|---|---|
| employeeId | string | Unique, assigned by admin |
| department | string | |

Assigned subjects are queried live from `subjects where teacherId == uid`.

---

### 2.4 `subjects/{subjectId}`
Owns the schedule. Lecture generation is triggered via the FastAPI backend.

| Field | Type | Notes |
|---|---|---|
| name | string | e.g. `"Data Structures"` |
| courseCode | string | e.g. `"CS-301"` |
| semesterLabel | string | e.g. `"Fall 2024"` — plain string, no separate collection |
| semesterStart | timestamp | |
| semesterEnd | timestamp | |
| teacherId | string | |
| department | string | |
| creditHours | number | |
| enrolledStudentIds | string[] | UIDs of enrolled students |
| schedule | array | `[{ day: "Monday", startTime: "09:00", endTime: "10:30" }, ...]` |

When a subject is saved, the frontend calls `POST /api/subjects/{id}/generate-lectures`. The backend iterates the semester date range and batch-writes lectures via the Firebase Admin SDK. If the schedule is edited later, only future `status: "scheduled"` lectures are deleted and regenerated — completed and ongoing lectures are never touched.

---

### 2.5 `lectures/{lectureId}`

| Field | Type | Notes |
|---|---|---|
| subjectId | string | |
| teacherId | string | |
| scheduledDate | string | ISO date `"2024-10-14"` |
| startTime | string | `"09:00"` |
| endTime | string | `"10:30"` |
| attendanceOpen | bool | |
| attendanceOpenedAt | timestamp \| null | |
| attendanceClosedAt | timestamp \| null | |
| lectureNumber | number | Sequential within the subject |
| status | string | `"scheduled"` \| `"ongoing"` \| `"completed"` \| `"cancelled"` |
| isManual | bool | `true` for one-off makeups added outside the schedule |
| createdAt | timestamp | |

**Auto-close via backend:** when the teacher client loads a lecture with `attendanceOpen: true` and the current time is past `endTime`, it calls `PATCH /api/lectures/{id}/check-close` and the backend writes the close atomically. On the student side, the active lecture list filters to `attendanceOpen: true AND scheduledDate == today AND endTime > now`, so expired lectures naturally drop off.

---

### 2.6 `attendance/{docId}`
Document ID is `{lectureId}_{studentId}` — enforces one record per student per lecture at the data level.

| Field | Type | Notes |
|---|---|---|
| lectureId | string | |
| subjectId | string | Denormalized |
| studentId | string | |
| markedAt | timestamp | |
| irisConfidence | number | Cosine similarity score, e.g. `0.93` |
| irisImagePath | string | Firebase Storage path of the verification frame (audit log) |
| status | string | `"pending"` \| `"approved"` \| `"rejected"` \| `"manual"` |
| approvedBy | string \| null | |
| approvedAt | timestamp \| null | |
| manuallyMarkedBy | string \| null | |
| note | string \| null | For manual entries |

Status flow: `pending` (iris submitted) → `approved` or `rejected` by teacher → `manual` if admin overrides.

A rejected student can re-submit (up to `maxIrisRetries`) while the window is still open. On retry the existing document is overwritten, not duplicated.

---

### 2.7 `systemConfig/main`
Single document, read by all roles on app start.

| Field | Type | Notes |
|---|---|---|
| attendanceThreshold | number | Shortage warning level, e.g. `75` (%) |
| irisMatchThreshold | number | Min cosine similarity to pass, e.g. `0.80` |
| maxIrisRetries | number | Attempts allowed per lecture |
| manualMarkingEnabled | bool | Global toggle for teacher manual marking |
| updatedAt | timestamp | |
| updatedBy | string | |

---

### 2.8 `notifications/{docId}`
In-app only. No push notifications. Real-time Firestore listener on the client picks these up.

| Field | Type | Notes |
|---|---|---|
| title | string | |
| body | string | |
| targetType | string | `"all"` \| `"role"` \| `"subject"` \| `"individual"` |
| targetValue | string | Role name, subjectId, or uid |
| createdAt | timestamp | |
| createdBy | string | Admin or teacher UID |
| readBy | string[] | UIDs who tapped it — drives unread badge |

Targeting is evaluated client-side: the app fetches all notifications where `targetType == "all"`, or `targetType == "role" && targetValue == currentUserRole`, or `targetType == "subject" && currentUser is enrolled/assigned`, or `targetType == "individual" && targetValue == currentUid`, then merges and deduplicates.

---

## 3. Key Flows

### 3.1 Account Creation
There is no self-registration. Admin creates every account. The React admin portal calls `POST /api/admin/users` — the FastAPI backend uses the Firebase Admin SDK to call `auth.createUser()`, writes the `users` + role Firestore documents, and returns the new `uid`. The new user's temporary password is shared out of band. On first login the user changes their password via the Firebase Auth client SDK. A "Forgot Password" link triggers Firebase's `sendPasswordResetEmail` for self-service recovery.

### 3.2 Iris Enrollment (First Login Gate — Android Only)
Students are routed to the enrollment screen before accessing anything. The Expo camera captures 3 frames; each is uploaded to Firebase Storage. Their Storage paths are sent to `POST /api/iris/enroll`. The backend:
1. Downloads each image from Firebase Storage
2. Preprocesses with OpenCV (grayscale, CLAHE, circular ROI crop)
3. Extracts a Gabor filter-based feature vector (512 floats) per frame
4. Averages the 3 embeddings element-by-element
5. Writes `irisEmbedding` and `irisImagePath` to `students/{uid}` in Firestore
6. Sets `irisEnrolled: true`

Until enrollment is complete, all other routes are blocked by a route guard in the Expo Router navigator. Admin can reset `irisEnrolled: false` to force re-enrollment.

### 3.3 Lecture Generation
When admin saves a subject with a schedule, the frontend calls `POST /api/subjects/{id}/generate-lectures`. The FastAPI backend iterates every date in the semester range, identifies matching weekday slots from the `schedule` array, and batch-writes lecture documents to Firestore via the Admin SDK. Lecture numbers are assigned sequentially starting from 1. If the schedule is edited, admin triggers `POST /api/subjects/{id}/regenerate-future-lectures` — the backend deletes only future `scheduled`-status lectures and rewrites them.

### 3.4 Attendance Window Lifecycle
1. Teacher calls `PATCH /api/lectures/{id}/open` → backend sets `attendanceOpen: true`, status `ongoing`
2. Students see the lecture appear in their active list (Firestore real-time listener)
3. Teacher calls `PATCH /api/lectures/{id}/close` OR backend auto-closes on next `check-close` call
4. Status → `completed`, `attendanceClosedAt` stamped
5. No submissions accepted after close — enforced at the backend, not just the client

### 3.5 Iris Verification (Mark Attendance — Android Only)
Student selects an open lecture and the camera activates. One frame is captured, uploaded to Firebase Storage, and its path sent to `POST /api/iris/verify` with `{ studentId, lectureId, imagePath }`. The backend:
1. Downloads the frame and the enrolled iris image from Firebase Storage
2. Preprocesses and extracts a fresh Gabor embedding
3. Computes cosine similarity against the stored embedding
4. If score ≥ `irisMatchThreshold`: writes the attendance doc with `status: "pending"`, returns success
5. If score < threshold: returns failure; client allows retry up to `maxIrisRetries`

### 3.6 Absent Calculation (On-the-fly)
Never stored. The backend exposes `GET /api/reports/student/{uid}/subject/{subjectId}` which queries Firestore, counts `approved + manual` records against non-cancelled lectures, and returns the percentage. `% = (approved + manual) / non-cancelled lectures × 100`. If below threshold, a warning badge is shown client-side.

### 3.7 Manual Override
When `manualMarkingEnabled` is true, the teacher calls `POST /api/attendance/manual`. The backend writes or overwrites the attendance doc with `status: "manual"` and a note. These records are visually flagged in all views.

---

## 4. Features by Role

### Admin
- Register and manage students and teachers (activate / deactivate / password reset via Firebase Admin SDK)
- Create subjects: assign teacher, enroll students, set schedule → trigger lecture generation via API
- Add or cancel individual lectures (makeups, cancellations)
- Edit subject schedule (future lectures regenerate via API, past untouched)
- Force iris re-enrollment for a student
- Attendance reports: per subject, per student, date range filter, CSV export
- Toggle manual marking, adjust system config thresholds
- Send in-app notifications (all / by role / by subject / individual)

### Teacher
- Dashboard: today's lectures with open/close toggle
- Real-time pending attendance list per lecture — Approve All or individually
- Reject and allow retry while window is open
- Manual mark (if admin has enabled it)
- Read-only attendance reports for own subjects, see shortage warnings
- Send in-app notifications to students enrolled in their subjects

### Student
- Iris enrollment gate on first login (Android only)
- Dashboard: today's schedule, per-subject attendance %, shortage warnings
- Mark attendance via iris scan (Android only) — live camera, retry on failure
- View full schedule (list + weekly grid) — available on web and Android
- Attendance history per subject with status and confidence scores
- In-app notification inbox with unread badge

---

## 5. Iris Recognition (Backend Pipeline)

All ML/CV runs on the FastAPI backend. The React Native app is only responsible for capturing a camera frame and uploading it to Firebase Storage. No model runs on-device.

### 5.1 Pipeline Steps
1. **Image acquisition** — Expo camera (Android) captures a frame; uploaded to Firebase Storage
2. **Download & decode** — FastAPI downloads the image via the Firebase Admin SDK
3. **Preprocessing (OpenCV)** — convert to grayscale, apply CLAHE for contrast normalisation, detect and crop the iris ROI using circular Hough transform
4. **Feature extraction** — apply a bank of Gabor filters at multiple scales and orientations; flatten responses into a 512-float feature vector
5. **PyTorch model (optional enhancement)** — a lightweight CNN trained on CASIA-Iris-Thousand can refine the embedding; Gabor alone is the baseline
6. **Matching** — cosine similarity between the fresh embedding and the stored enrollment embedding
7. **Decision** — score ≥ `irisMatchThreshold` passes; below threshold triggers retry up to `maxIrisRetries`

### 5.2 Model Training (Offline, Pre-deployment)
- **Dataset:** CASIA-Iris-Thousand (1000 subjects, 20 images each)
- **Framework:** PyTorch — train a lightweight CNN to produce discriminative embeddings
- **Export:** save as `.pt` or ONNX, loaded by FastAPI on startup
- Gabor baseline is used if the CNN is not yet trained — the pipeline is modular and the two are swappable

### 5.3 Enrollment vs Verification

| Step | Enrollment (once) | Verification (per attendance) |
|---|---|---|
| Frames | 3 frames averaged | 1 frame |
| Output | Embedding stored in Firestore | Embedding compared, not stored |
| Image storage | Firebase Storage (reference copy) | Firebase Storage (audit log) |
| Endpoint | `POST /api/iris/enroll` | `POST /api/iris/verify` |

---

## 6. Architecture

### 6.1 High-Level

| Layer | Technology | Responsibility |
|---|---|---|
| Web Frontend | React (JavaScript) | Admin portal, teacher portal, student view/history |
| Mobile Frontend | React Native + Expo | All web features + iris camera capture |
| Shared Logic | JavaScript modules | API calls, auth helpers, formatting utilities |
| Backend API | FastAPI (Python) | Auth validation, ML inference, business logic, Firestore writes |
| Auth | Firebase Auth | JWT issuance, password reset, account management |
| Database | Firestore | All structured data — users, subjects, lectures, attendance |
| File Storage | Firebase Storage | Iris images (enrollment + verification frames) |
| ML/CV | OpenCV + Gabor + PyTorch | Preprocessing, feature extraction, matching |
| Deployment | Render (free tier) | FastAPI backend; React web served as static build |

### 6.2 Request Flow (Iris Verification)

```
React Native (Expo)                FastAPI Backend              Firebase
      |                                   |                         |
      |-- capture frame                   |                         |
      |-- upload to Storage --------------|------------------------>|
      |                                   |                         |
      |-- POST /api/iris/verify --------->|                         |
      |   { studentId, lectureId,         |<-- download images ---->|
      |     imagePath }                   |                         |
      |                                   |-- OpenCV preprocess     |
      |                                   |-- Gabor extract         |
      |                                   |-- cosine similarity     |
      |                                   |                         |
      |                                   |-- write attendance ---->|
      |<-- { score, status } -------------|                         |
```

### 6.3 Folder Structure

**Backend (FastAPI)**
```
backend/
  app/
    main.py                   FastAPI app entry point
    config.py                 Firebase credentials, env vars
    routers/
      auth.py                 /api/auth/*
      users.py                /api/admin/users/*
      subjects.py             /api/subjects/*
      lectures.py             /api/lectures/*
      attendance.py           /api/attendance/*
      iris.py                 /api/iris/enroll, /api/iris/verify
      reports.py              /api/reports/*
      notifications.py        /api/notifications/*
      config.py               /api/system-config/*
    services/
      iris_service.py         OpenCV + Gabor pipeline
      firebase_service.py     Firestore + Storage helpers
      lecture_service.py      Lecture generation logic
    models/
      schemas.py              Pydantic request/response models
    ml/
      gabor.py                Gabor filter bank
      pytorch_model.py        CNN wrapper (optional)
      casia_train.py          Offline training script
      iris_model.pt           Trained weights (gitignored, loaded at startup)
  requirements.txt
  Dockerfile
```

**Web Frontend (React)**
```
frontend-web/
  src/
    api/                      Axios instances per domain
    context/                  AuthContext, ConfigContext
    pages/
      auth/                   Login
      admin/                  Dashboard, Users, Subjects, Lectures, Reports, Config, Notifications
      teacher/                Dashboard, LectureDetail, Notifications
      student/                Dashboard, Schedule, History, Notifications
    components/
      shared/                 StatusPill, StatCard, NotificationBadge, DataTable
      layout/                 Sidebar, TopBar, RoleGuard
    hooks/                    useAuth, useFirestore, useConfig
    utils/                    dateUtils.js, csvExport.js, validators.js
  public/
  package.json
```

**Mobile Frontend (React Native + Expo)**
```
frontend-mobile/
  app/                        Expo Router file-based routing
    (auth)/                   Login screen
    (admin)/                  Admin screens (mirrors web)
    (teacher)/                Teacher screens
    (student)/
      enroll-iris.jsx         Enrollment gate
      dashboard.jsx
      mark-attendance.jsx     Camera + upload + verify
      schedule.jsx
      history.jsx
      notifications.jsx
  components/                 Shared RN components
  hooks/                      Shared with web where possible
  utils/                      Shared with web where possible
  package.json
```

---

## 7. Tech Stack

| Layer | Choice |
|---|---|
| Web Framework | React (JavaScript) |
| Mobile Framework | React Native + Expo |
| Camera (Android) | expo-camera |
| State Management | React Context + custom hooks (or Zustand) |
| Navigation (Web) | React Router v6 |
| Navigation (Mobile) | Expo Router (file-based) |
| HTTP Client | Axios |
| Backend Framework | FastAPI (Python) |
| Auth | Firebase Auth (free Spark tier) |
| Database | Firebase Firestore (free Spark tier) |
| File Storage | Firebase Storage (free Spark tier) |
| CV Preprocessing | OpenCV (Python) |
| Feature Extraction | Gabor filter bank (NumPy / SciPy) |
| ML Model | PyTorch (trained on CASIA-Iris-Thousand) |
| Backend Deployment | Render (free tier) |
| CSV Export | papaparse (web) / expo-sharing (Android) |

---

## 8. API Endpoints (FastAPI)

### Auth & Users

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/verify-token` | Validate Firebase ID token, return role |
| POST | `/api/admin/users` | Create user (Admin SDK + Firestore write) |
| PATCH | `/api/admin/users/{uid}` | Update user status / details |
| DELETE | `/api/admin/users/{uid}` | Deactivate user |
| POST | `/api/admin/users/{uid}/reset-iris` | Set `irisEnrolled: false` |

### Subjects & Lectures

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/subjects` | Create subject |
| PATCH | `/api/subjects/{id}` | Update subject |
| POST | `/api/subjects/{id}/generate-lectures` | Batch-generate lectures for full semester |
| POST | `/api/subjects/{id}/regenerate-future-lectures` | Regenerate only future `scheduled` lectures |
| POST | `/api/lectures` | Add manual lecture |
| PATCH | `/api/lectures/{id}/open` | Open attendance window |
| PATCH | `/api/lectures/{id}/close` | Close attendance window |
| PATCH | `/api/lectures/{id}/check-close` | Auto-close if past `endTime` |
| PATCH | `/api/lectures/{id}/cancel` | Cancel lecture |

### Iris & Attendance

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/iris/enroll` | Enroll iris: process 3 frames, store embedding |
| POST | `/api/iris/verify` | Verify iris: match against stored embedding |
| POST | `/api/attendance/manual` | Manual attendance mark by teacher/admin |
| PATCH | `/api/attendance/{docId}/approve` | Approve pending record |
| PATCH | `/api/attendance/{docId}/reject` | Reject pending record |

### Reports & Config

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/reports/subject/{id}` | Per-subject attendance report |
| GET | `/api/reports/student/{uid}/subject/{id}` | Per-student per-subject stats |
| GET | `/api/reports/export/csv` | CSV download with filters |
| GET | `/api/system-config` | Read system config |
| PATCH | `/api/system-config` | Update system config |

---

## 9. UI & Design System

The warm neutral design language is preserved exactly. Both React (web) and React Native (mobile) implement the same design tokens and component patterns.

### 9.1 Colour Tokens

| Token | Hex | Usage |
|---|---|---|
| Background | `#F5F3EF` | All screen backgrounds |
| Surface Elevated | `#FAF8F4` | Cards, list items |
| Surface | `#EDE9E3` | Input fields, chip backgrounds |
| Surface Variant | `#E5E1DA` | Card strokes, dividers |
| Dark Ink / Primary | `#0B0D14` | Hero cards, icon tiles, primary text |
| Text Primary | `#0B0D14` | Headings, bold values |
| Text Secondary | `#6B6760` | Body descriptions |
| Text Muted | `#9B9790` | Timestamps, labels, subtitles |
| Text Disabled | `#C4BFB8` | Placeholder, inactive icons |
| Text On Dark | `#F5F3EF` | Text on dark ink cards |
| Green | `#2A6E35` | Approved, completed, positive stats |
| Error Red | `#B03030` | Rejected, shortage warning, badge |
| Warning Amber | `#C47018` | Pending, low attendance warning |
| In-Progress Blue | `#1A3A7A` | Ongoing lecture |

**Attendance & lecture status pill colours:**

| Status | Pill Background | Pill Text |
|---|---|---|
| scheduled | `#E5E1DA` | `#4A4845` |
| ongoing | `#D4DCF0` | `#0A2460` |
| completed | `#D4EBD8` | `#174520` |
| cancelled | `#F5D8D8` | `#8A1E1E` |
| pending (attendance) | `#FAF0DC` | `#3D2500` |
| approved | `#D4EBD8` | `#174520` |
| rejected | `#F5D8D8` | `#8A1E1E` |
| manual | `#EDE0F5` | `#4A1E6B` |

### 9.2 Typography

| Style | Font | Size | Usage |
|---|---|---|---|
| Display | Plus Jakarta Sans SemiBold | 30sp | Greeting |
| Heading | Plus Jakarta Sans SemiBold | 18–22sp | Section titles |
| Card title | Plus Jakarta Sans SemiBold | 14–15sp | Module card names |
| Stat value | Plus Jakarta Sans SemiBold | 24–28sp | Dashboard numbers |
| Body | DM Sans Regular | 12–13sp | Descriptions, subtitles |
| Label | DM Sans Medium | 10–11sp | Timestamps, muted labels |
| Eyebrow | DM Sans Medium | 9sp | Section pills (`ADMIN PORTAL`, `MODULES`) |

React web: load via Google Fonts CSS import. React Native: bundle as assets and register in `app.json`.

### 9.3 Component Patterns

**Standard Module Card** — background `#FAF8F4`, corner `20dp`, no elevation, stroke `1dp #E5E1DA`. Icon tile: `38×38dp`, corner `11dp`, background `#0B0D14`, icon `18×18dp` white. Title Plus Jakarta Sans SemiBold 14sp, subtitle DM Sans Regular 11sp muted.

**Hero Card (dark)** — background `#0B0D14`, corner `22dp`, no elevation, no stroke. Text inverted (`#F5F3EF` headings, `#6B6760` secondary). Icon tile background `#1E2130`, stroke `1dp #2A2E40`. Used for the flagship stat card on each role's dashboard.

**Stats Strip** — card `#FAF8F4`, stroke `1dp #E5E1DA`, corner `18dp`. 3–4 columns with `1dp #DDD8D0` vertical dividers. Stat value 28sp semibold, label 11sp muted.

**Eyebrow Pill** — 9sp uppercase DM Sans Medium, letter-spacing 0.14, rounded rect background `#EDE9E3`. Used as section labels above module grids.

**Status Pill** — rounded rect, `8dp` horizontal / `3dp` vertical padding, 10–11sp DM Sans Medium. One reusable `StatusPill` component maps a status string to the colour pairs above.

**Unread Badge** — pill shape, background `#B03030`, white text 10sp. Hidden when count is 0.

**Avatar Tile** — `48×48dp`, corner `14dp`, background `#0B0D14`, initials Plus Jakarta Sans SemiBold 19sp white.

### 9.4 Screen Layouts

**Admin Dashboard**
- Header: `ADMIN PORTAL` eyebrow pill · greeting · date · avatar + sign out
- Hero dark card: system name, 3 micro-stats (Total Students · Total Teachers · Lectures Today)
- Stats strip: Active Subjects · Pending Approvals · Low Attendance Alerts · Total Lectures
- 2-col module grid: User Management · Subject Management · Lecture Management · Reports
- Full-width cards: System Config · Notifications (with unread badge)

**Teacher Dashboard**
- Header: `TEACHER PORTAL` eyebrow · greeting · date · avatar + sign out
- Hero dark card: lectures today, pending approvals count, currently open windows
- Today's Lectures list — each lecture is a card: subject name + code · time range · status pill · Open/Close button
- Full-width: Notifications (with unread badge)

**Student Dashboard**
- Header: `STUDENT PORTAL` eyebrow · greeting · date · avatar + sign out
- Hero dark card: overall attendance %, enrolled subjects count, amber warning strip if below threshold
- Today's schedule (compact strip, up to 4 slots)
- 2-col module grid: Mark Attendance (Android) or notice (web) · My Subjects
- Full-width cards: Attendance History · Notifications (with unread badge)

**Lecture Row (in list)**
Subject name (semibold) + course code (muted) · time range · status pill. Teacher view adds open/close toggle. Student view adds iris confidence score + attendance status if already submitted.

**Attendance History Row**
Subject name + lecture number · date · status pill · iris confidence score (`0.93`) in muted text.

### 9.5 React Implementation Notes

- CSS custom properties for all colour tokens — apply via `className` or `style` prop, never hardcoded
- Cards: `borderRadius: 20px`, `border: 1px solid #E5E1DA`, `background: #FAF8F4`, `boxShadow: none`
- Inputs: `background: #EDE9E3`, `borderRadius: 14px`, no underline, no outline on focus (replace with border colour change)
- Dashboard screens: `maxWidth: 480px` on mobile web, `padding: 0 22px`, `paddingTop: 52px`
- Bottom nav (React Native): 3 items per role, `background: #FAF8F4`, selected `#0B0D14`, unselected `#9B9790`
- Module grid: CSS Grid `grid-template-columns: 1fr 1fr` (web) / `FlatList numColumns={2}` (RN)

---

## 10. Platform Support

| Feature | Android (RN + Expo) | Web (React) |
|---|---|---|
| Iris enrollment | ✅ | ❌ (notice shown) |
| Mark attendance | ✅ | ❌ (notice shown) |
| View schedule & history | ✅ | ✅ |
| In-app notifications | ✅ | ✅ |
| Teacher approval | ✅ | ✅ |
| Admin portal | ✅ | ✅ (preferred) |
| CSV export | ✅ (expo-sharing) | ✅ (browser download) |

---

## 11. Screen & Routing Map

**Web (React Router)**
```
/login
  ├─ inactive → sign out + error
  ├─ admin    → /admin/dashboard
  ├─ teacher  → /teacher/dashboard
  └─ student  → /student/dashboard

/admin/dashboard
  ├─ /admin/users               (list, create, edit, deactivate)
  ├─ /admin/subjects            (list, create, edit schedule, enroll students)
  ├─ /admin/lectures            (view generated, add manual, cancel)
  ├─ /admin/reports             (per subject, per student, CSV)
  ├─ /admin/config              (thresholds, manual marking toggle)
  └─ /admin/notifications       (compose + history)

/teacher/dashboard
  ├─ /teacher/lectures/:id      (open/close window, pending list, approve/reject)
  └─ /teacher/notifications     (compose + inbox)

/student/dashboard
  ├─ /student/schedule          (list + weekly grid)
  ├─ /student/history           (all records, filters)
  └─ /student/notifications     (inbox, mark read)
```

**Mobile (Expo Router — Android)**
```
/(auth)/login
/(student)/enroll-iris          Gate: cannot navigate away until enrolled
/(student)/dashboard
/(student)/mark-attendance      Camera → upload → POST /api/iris/verify → result
/(student)/schedule
/(student)/history
/(student)/notifications
/(teacher)/*                    Same routes as web teacher portal
/(admin)/*                      Same routes as web admin portal
```

---

## 12. Firestore Indexes Required

Compound queries need manual index creation in Firebase Console:

| Collection | Fields | Used for |
|---|---|---|
| lectures | `subjectId` ASC, `scheduledDate` ASC | Teacher/student schedule view |
| lectures | `teacherId` ASC, `scheduledDate` ASC | Teacher dashboard (today's lectures) |
| lectures | `subjectId` ASC, `status` ASC | Filtering cancelled lectures in reports |
| attendance | `studentId` ASC, `subjectId` ASC | Per-student per-subject history |
| attendance | `lectureId` ASC, `status` ASC | Teacher pending list |
| notifications | `targetType` ASC, `createdAt` DESC | Notification inbox query |

---

## 13. Development Phases

### Phase 1 — Foundation (Week 1–2)
- Monorepo setup: `backend/`, `frontend-web/`, `frontend-mobile/` with shared utilities package
- FastAPI project scaffolded: routers, Firebase Admin SDK configured, health check endpoint
- React project: routing, `AuthContext`, Firebase client SDK, role-based routing
- React Native + Expo project: Expo Router navigation, Firebase client SDK, `expo-camera` permission setup
- Login flow: Firebase Auth client → `POST /api/auth/verify-token` → role-based routing
- Inactive guard enforced at backend (`403`) and client (sign out + error)
- Seed `systemConfig/main`

### Phase 2 — Admin Portal (Week 3–4)
- User creation: React form → `POST /api/admin/users` → Firebase Admin SDK + Firestore write
- Subject creation with schedule input → `POST /api/subjects/{id}/generate-lectures`
- Lecture management: view generated, add manual, cancel
- Student enrollment into subjects
- System config page (thresholds, manual marking toggle)

### Phase 3 — Iris Pipeline (Week 5–6)
- Backend `iris_service.py`: OpenCV preprocessing, Gabor filter bank, cosine similarity
- CASIA-Iris-Thousand: offline training script for PyTorch CNN (runs locally, weights deployed to Render)
- `POST /api/iris/enroll`: download 3 frames from Storage, average embeddings, write to Firestore
- `POST /api/iris/verify`: match and return score + decision
- React Native enrollment screen: expo-camera, 3-frame capture, upload to Storage, call enroll endpoint
- Enrollment gate in Expo Router: redirect to `enroll-iris` until `irisEnrolled: true`
- Admin: iris re-enrollment reset via `POST /api/admin/users/{uid}/reset-iris`

### Phase 4 — Teacher Portal (Week 7)
- Teacher dashboard with today's lectures (Firestore real-time listener)
- Open/close attendance window via PATCH endpoints
- Auto-close: client calls `/check-close` on lecture load if past `endTime`
- Real-time pending attendance list, Approve All, individual approve/reject
- Manual marking (when enabled by system config)

### Phase 5 — Student Portal (Week 8)
- Student dashboard: attendance % from `GET /api/reports/student/{uid}/subject/{id}`, shortage warning
- Mark attendance flow (Android): active lecture list → camera → upload → verify → result screen
- Web student: iris-restricted features show informational notice
- Schedule view (list + weekly grid) — both platforms
- Attendance history with filters — both platforms

### Phase 6 — Notifications, Reports & Polish (Week 9)
- Notification compose + inbox for all roles with unread badge (Firestore real-time listener)
- Admin reports: per subject, per student, CSV export via `GET /api/reports/export/csv`
- Firestore security rules locked down: role-based, students cannot write attendance directly
- Backend: Pydantic validation, error handling, `403` on inactive users
- Error states, loading states, empty states across all screens

### Phase 7 — Testing & Deploy (Week 10)
- End-to-end test: enroll iris → generate lectures → open window → mark attendance → approve → view report
- Backend deployed to Render (Dockerfile, environment variables for Firebase credentials)
- React web build → Render static site or Firebase Hosting
- Android APK via `eas build` (Expo)
- Composite Firestore indexes created and verified
- CORS configured on FastAPI for web frontend origin

---

## 14. Open Decisions

- **Iris model accuracy:** Gabor baseline vs. PyTorch CNN — benchmark on real iris images before Phase 6; if Gabor accuracy is poor, prioritise CNN training in Phase 3.
- **Rejected records:** Count as absent or just "not marked"? Affects the shortage calculation in the report endpoint.
- **Schedule edits mid-semester:** Regenerate only future `scheduled` lectures, or prompt admin to confirm which to keep?
- **Teacher department:** Single department or multiple? Affects subject assignment query in the admin portal.
- **Render cold starts:** Free tier sleeps after inactivity — first iris verify per session may be slow. Consider a keep-alive ping from the frontend on app load.
- **Shared code:** Local npm workspace package or duplicated utility code between web and mobile?

---

*Settle the open decisions, then Phase 1 begins.*
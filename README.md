# Smart Attendance System with Iris Detection

A full-stack attendance management system that uses iris biometrics to verify student identity. Instead of manual roll calls or easily-faked check-ins, students scan their iris through the Android app to mark attendance. The system matches the scan against a stored template and records the result automatically.

## How It Works

There are three user roles — **Admin**, **Teacher**, and **Student** — each with their own portal.

**Admins** manage everything: creating user accounts, setting up subjects and semester schedules, generating lecture timetables, and configuring system thresholds (like the minimum attendance percentage required).

**Teachers** open and close the attendance window for each lecture. When a window is open, enrolled students can scan their iris to mark themselves present. Teachers can also approve, reject, or manually mark attendance records.

**Students** use the Android app. Before they can mark attendance, they go through a one-time **iris enrollment** — the app captures 3 frames of their eye, uploads them to Cloudinary, and the backend processes them into a 512-dimensional embedding stored in Firestore. On each lecture, when the teacher opens the attendance window, the student opens the app, scans their iris, and the backend compares the fresh scan against their stored template using cosine similarity. If the score meets the threshold, attendance is recorded as pending and the teacher approves it.

The **web app** is used by admins and teachers on desktop. The **Android APK** is for students (and can also be used by admins and teachers on mobile).

Authentication works differently on each platform — the web uses Firebase Auth directly, while the mobile app uses a custom JWT issued by the backend after verifying credentials against Firebase.

---

## Stack

| Layer | Technology |
|---|---|
| Web Frontend | React 18 + React Router v6 (CRA) |
| Mobile Frontend | React Native + Expo (Expo Router, Android only) |
| Backend | FastAPI + Uvicorn (Python 3.11) |
| Database | Firebase Firestore |
| Auth | Firebase Auth (web) / Custom JWT (mobile) |
| File Storage | Cloudinary (iris images) |
| ML / CV | OpenCV + Gabor filter bank + PyTorch CNN (optional) |
| Backend Deploy | Render |

---

## Project Structure

```
root/
  backend/              FastAPI backend
  frontend-web/         React admin/teacher/student portal
  frontend-mobile/      Expo Android app
  shared/               Shared JS utilities (constants, dateUtils, validators)
  package.json          Root workspace scripts
```

---

## Prerequisites

Make sure you have these installed before starting:

- **Node.js** v18+ and npm v9+
- **Python** 3.11
- **Git**
- **Expo CLI** — `npm install -g expo-cli`
- **EAS CLI** (for building APK) — `npm install -g eas-cli`
- A **Firebase** project with Firestore and Authentication enabled
- A **Cloudinary** account

---

## 1. Clone the Repository

```bash
git clone <your-repo-url>
cd "Smart Attendance System with Iris Detection"
```

---

## 2. Firebase Setup

### 2.1 Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing: `smart-attendance-system-a3b97`)
3. Enable **Authentication** → Sign-in method → **Email/Password**
4. Enable **Firestore Database** → Start in production mode

### 2.2 Get the Service Account Key (Backend)

1. Firebase Console → Project Settings → **Service accounts**
2. Click **Generate new private key** → download the JSON file
3. Rename it to `smart-attendance-system-a3b97-firebase-adminsdk-fbsvc-157c5ab1f3.json`
4. Place it in `backend/`

### 2.3 Get the Web App Config (Frontend)

1. Firebase Console → Project Settings → **Your apps** → Web app
2. Copy the config object — you'll need it for the `.env` files below

---

## 3. Cloudinary Setup

1. Sign up at [cloudinary.com](https://cloudinary.com)
2. From the dashboard note your: **Cloud name**, **API Key**, **API Secret**
3. Go to **Settings → Upload → Upload presets**
4. Create an **unsigned** preset named `iris_unsigned`
   - Folder: `iris`
   - Signing mode: **Unsigned**

---

## 4. Backend Setup

```bash
cd backend
```

### 4.1 Create a virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 4.2 Install dependencies

```bash
pip install -r requirements.txt
```

> **Note:** `requirements.txt` must include `httpx`, `PyJWT`, and `cloudinary`. If they are missing, add them manually before installing.

### 4.3 Create the `.env` file

Create `backend/.env` with the following content:

```env
FIREBASE_CREDENTIALS_PATH=./smart-attendance-system-a3b97-firebase-adminsdk-fbsvc-157c5ab1f3.json
FIREBASE_WEB_API_KEY=your_firebase_web_api_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
JWT_SECRET=a_long_random_secret_string
FRONTEND_ORIGIN=http://localhost:3000
ENVIRONMENT=development
```

### 4.4 Seed Firestore system config

Run this once to create the `systemConfig/main` document in Firestore:

```bash
python seed_config.py
```

This sets the default values:
- `attendanceThreshold`: 75%
- `irisMatchThreshold`: 0.80
- `maxIrisRetries`: 3
- `manualMarkingEnabled`: true

### 4.5 Run the backend

```bash
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`
API docs available at `http://localhost:8000/docs` (development mode only)

---

## 5. Web Frontend Setup

```bash
cd frontend-web
```

### 5.1 Install dependencies

```bash
npm install
```

### 5.2 Create the `.env` file

Create `frontend-web/.env`:

```env
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_API_URL=http://localhost:8000
```

### 5.3 Run the web app

```bash
npm start
```

Web app runs at `http://localhost:3000`

---

## 6. Mobile Frontend Setup

```bash
cd frontend-mobile
```

### 6.1 Install dependencies

```bash
npm install
```

### 6.2 Create the `.env` file

Create `frontend-mobile/.env`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_API_URL=http://<your-local-ip>:8000
```

Replace `<your-local-ip>` with your machine's LAN IP (e.g. `192.168.1.5`). The Android device/emulator cannot reach `localhost` — it needs the actual network IP.

To find your IP on Windows: run `ipconfig` and look for **IPv4 Address** under your Wi-Fi adapter.

### 6.3 Run in Expo Go (development)

```bash
npx expo start
```

Scan the QR code with the **Expo Go** app on your Android device.

---

## 7. Building the Android APK

The `.env` file is gitignored and **not available** to EAS cloud builds. All `EXPO_PUBLIC_*` variables must be declared in `eas.json` under the build profile you use.

### 7.1 Log in to EAS

```bash
eas login
```

### 7.2 Build the APK

```bash
cd frontend-mobile
eas build --platform android --profile production
```

The `production` profile in `eas.json` already includes all required `EXPO_PUBLIC_*` env vars. Update them there if your backend URL or Firebase config changes.

### 7.3 Download and install

Once the build completes, EAS provides a download link. Install the `.apk` directly on your Android device (enable **Install from unknown sources** in device settings).

---

## 8. Running Everything Locally (Root Scripts)

From the root directory you can run each service using the workspace scripts:

```bash
# Backend (requires venv to be activated first)
npm run backend

# Web frontend
npm run web

# Mobile (Expo dev server)
npm run mobile
```

---

## 9. Deployment (Render)

### 9.1 Backend on Render

1. Connect your GitHub repo to [Render](https://render.com)
2. Create a **Web Service** pointing to the `backend/` directory
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add these environment variables in the Render dashboard:

| Key | Value |
|---|---|
| `FIREBASE_CREDENTIALS_JSON` | Paste the entire contents of your service account JSON file |
| `FIREBASE_WEB_API_KEY` | Your Firebase Web API key |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret |
| `JWT_SECRET` | A long random secret string |
| `FRONTEND_ORIGIN` | Your deployed web frontend URL |
| `ENVIRONMENT` | `production` |

> `FIREBASE_CREDENTIALS_JSON` replaces the service account file — paste the raw JSON string as the value.

### 9.2 Web Frontend on Render (Static Site)

1. Create a **Static Site** pointing to `frontend-web/`
2. Build command: `npm install && npm run build`
3. Publish directory: `build`
4. Add the same `REACT_APP_*` env vars, with `REACT_APP_API_URL` set to your Render backend URL

### 9.3 Mobile APK pointing to production

Update `EXPO_PUBLIC_API_URL` in `eas.json` to your Render backend URL, then rebuild the APK.

---

## 10. First-Time Admin Setup

After deployment, create the first admin user directly via the API:

```bash
curl -X POST https://your-backend-url/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_jwt>" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword",
    "fullName": "System Admin",
    "role": "admin",
    "cnic": "3310012345678",
    "dateOfBirth": "1990-01-01"
  }'
```

Or use the Firestore console to manually create the first admin document in the `users` collection, then create the corresponding Firebase Auth user.

---

## 11. Utility Scripts

These run from the `backend/` directory with the virtual environment activated.

### Seed system config
```bash
python seed_config.py
```

### Reset the database (destructive — deletes all non-admin users, subjects, lectures, attendance)
```bash
python cleanup_db.py
```

---

## 12. Firestore Collections Reference

| Collection | Doc ID | Purpose |
|---|---|---|
| `users` | `{uid}` | All users — role, status, profile |
| `students` | `{uid}` | Student-specific data + iris embedding |
| `teachers` | `{uid}` | Teacher-specific data |
| `subjects` | `{uuid}` | Subjects with schedule and enrolled students |
| `lectures` | `{uuid}` | Individual lecture instances |
| `attendance` | `{lectureId}_{studentId}` | Attendance records |
| `systemConfig` | `main` | Global thresholds and toggles |
| `notifications` | `{uuid}` | System notifications |

---

## 13. Common Issues

**Mobile login fails after APK install**
- Confirm `EXPO_PUBLIC_API_URL` in `eas.json` points to the live backend URL, not `localhost`
- Confirm `FIREBASE_WEB_API_KEY` is set in Render environment variables
- Confirm `httpx`, `PyJWT`, and `cloudinary` are in `requirements.txt`

**Backend 500 on startup**
- Check Render logs — likely a missing environment variable
- `validate_config()` in `config.py` will log which vars are missing

**Render free tier — first request is slow**
- Render free tier spins down after 15 min of inactivity. First request after sleep takes 30–60 seconds. This is expected behavior on the free plan.

**Iris enrollment fails**
- Confirm the `iris_unsigned` upload preset exists in your Cloudinary account
- Confirm the preset is set to **Unsigned**
- Check that the Android device has camera permission granted

**Student redirected to enroll-iris on every login**
- The `irisEnrolled` field in `students/{uid}` is `false` or missing
- Complete enrollment or use admin panel to reset and re-enroll

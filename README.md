# 🚀 Smart Attendance Management System (Zero Dedicated Biometric Hardware)

A production-grade, standalone smart attendance management system designed to eliminate dedicated fingerprint scanners, RFID readers, and hardware biometric kiosks. Built with **Dynamic Rotating QR Codes + GPS Geofencing + 6-Digit OTP** as the primary verification pipeline, and **Camera-Based Face Liveness Fallback** using students' existing smartphone or laptop cameras.

---

## 🌟 Key Capabilities & Features

### 1. Primary Attendance Pipeline: `Dynamic QR + GPS + OTP`
- **Dynamic Rotating QR Codes:** Generates cryptographically signed, timestamped QR tokens that automatically rotate (every 15s) with a real-time countdown ring to neutralize screenshot sharing and replay attacks.
- **GPS Geofencing:** Accurate distance computation using the **Haversine formula** comparing student device GPS coordinates against authorized classroom coordinates (e.g. 150m radius).
- **Time-Limited OTP:** Secure 6-digit numeric OTP displayed on the faculty screen with attempt-limiting safeguards and cryptographic hashing.
- **Late vs Present Grace Period:** Automatically classifies check-ins as **Present** (0–15 mins) or **Late** (15–30 mins), and rejects check-ins once the lecture session closes.
- **Atomic Duplicate Prevention:** Database-level `UNIQUE(student_id, session_id)` constraint prevents double check-ins even under concurrent burst requests.

### 2. Fallback Attendance Pipeline: `Face Biometrics + GPS + OTP`
- **Zero Dedicated Hardware:** Uses standard laptop/smartphone webcams via HTML5 `MediaDevices` API.
- **Privacy-First Vector Descriptors:** Facial images are converted into irreversible 128-dimensional mathematical vector embeddings. **Zero raw photo images or video recordings are stored on servers.**
- **Anti-Spoofing Liveness Challenges:** Multi-frame liveness checks requiring natural eye blinks and head pose depth calibration.
- **Data Sovereignty:** Students maintain full legal rights to enroll with explicit consent and can permanently delete/revoke their biometric templates at any time.

### 3. Role Portals
- **Admin Portal:** System KPI dashboard, 14-day attendance charts, user directory (Students & Faculty CRUD), academic hierarchy manager (Departments, Classes, Sections, Subjects), campus geofences manager with latitude/longitude picker, dynamic security rules configurator, forensic misuse audit center, and Excel (.xlsx) / CSV export.
- **Faculty Portal:** Course assignments, "Start Attendance Session" launcher modal (Subject, Class, Period, Mode, Geofence, Duration), **Live Attendance Room** with animated dynamic QR, OTP display, live attendees stream with real-time Socket.io updates, session pause/resume/close, and manual attendance correction with required audit reason logging.
- **Student Portal:** Active attendance sessions with 1-click QR Scan or Face Fallback check-in, personal attendance percentage gauge, low-attendance alert warning banner (&lt;75%) with deficit recovery counter, subject-wise performance breakdown, and biometric consent manager.

---

## 🔑 Quick Login Demo Accounts

Click the **"Quick Demo Switcher"** button in the top navbar or use the following preconfigured accounts:

| Role | Name | Email | Password | Key Highlights |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Dr. Vikram Malhotra | `admin@college.edu` | `Admin@123` | Full control, Geofences, Rules, Audit Logs, Reports |
| **Faculty** | Prof. Rajesh Sharma | `faculty.sharma@college.edu` | `Faculty@123` | Start sessions, Dynamic QR, OTP, Live Student Stream |
| **Student** | Alex Johnson | `alex@college.edu` | `Student@123` | Enrolled Face Biometrics, 95% Overall Attendance |
| **Student** | Rahul Mehta | `rahul@college.edu` | `Student@123` | Low Attendance (68%), Recovery Deficit Meter |

---

## 🛠️ Technology Stack & Architecture

- **Backend:** Node.js, Express 5, Better-SQLite3 (WAL mode & Foreign Keys enabled), Socket.io (WebSocket real-time sync), JWT, BcryptJS, Morgan, Helmet, XLSX.
- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide React Icons, Chart.js & React-Chartjs-2, QRCode.React, Html5-Qrcode, Canvas-Confetti, Web Audio API sound synthesizer.
- **Storage:** Standalone SQLite database (`server/database/attendance.db`) initialized with realistic historical data, active sessions, and test coordinates.

---

## 💻 Running the Project Locally

```bash
# 1. Install dependencies
npm install
cd client && npm install && cd ..

# 2. Seed database with rich sample data (Already initialized!)
npm run seed

# 3. Start production server (API + Frontend on port 5000)
npm start

# 4. Or start full-stack development mode with Vite hot-reload:
npm run dev
```

Open **`http://localhost:5000`** in your browser.

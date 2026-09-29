const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Ensure database folder exists
const dbDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.DB_PATH);

// Enable WAL mode for high concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    -- USERS TABLE
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'faculty', 'student')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'inactive')),
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- DEPARTMENTS TABLE
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ACADEMIC YEARS TABLE
    CREATE TABLE IF NOT EXISTS academic_years (
      id TEXT PRIMARY KEY,
      year_number INTEGER NOT NULL,
      label TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- CLASSES TABLE
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (year_id) REFERENCES academic_years(id) ON DELETE CASCADE
    );

    -- SECTIONS TABLE
    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );

    -- SUBJECTS TABLE
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department_id TEXT NOT NULL,
      semester INTEGER DEFAULT 1,
      credits INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    );

    -- STUDENTS TABLE
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      student_id TEXT UNIQUE NOT NULL,
      roll_no TEXT NOT NULL,
      department_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      section_id TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
      FOREIGN KEY (year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL
    );

    -- FACULTY TABLE
    CREATE TABLE IF NOT EXISTS faculty (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      faculty_id TEXT UNIQUE NOT NULL,
      department_id TEXT NOT NULL,
      designation TEXT DEFAULT 'Assistant Professor',
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
    );

    -- FACULTY ASSIGNMENTS TABLE
    CREATE TABLE IF NOT EXISTS faculty_assignments (
      id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      section_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
    );

    -- ATTENDANCE LOCATIONS (GEOFENCES)
    CREATE TABLE IF NOT EXISTS attendance_locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_meters REAL NOT NULL DEFAULT 100.0,
      is_active INTEGER DEFAULT 1,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- SYSTEM & ATTENDANCE SETTINGS
    CREATE TABLE IF NOT EXISTS attendance_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ATTENDANCE SESSIONS
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      section_id TEXT,
      location_id TEXT NOT NULL,
      attendance_mode TEXT NOT NULL DEFAULT 'qr_otp',
      allow_face_fallback INTEGER DEFAULT 1,
      period_name TEXT DEFAULT 'Period 1',
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      late_threshold_time DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'closed')),
      current_otp_hash TEXT NOT NULL,
      current_otp_display TEXT NOT NULL,
      otp_expires_at DATETIME NOT NULL,
      current_qr_token TEXT NOT NULL,
      qr_expires_at DATETIME NOT NULL,
      total_expected INTEGER DEFAULT 0,
      total_present INTEGER DEFAULT 0,
      total_late INTEGER DEFAULT 0,
      total_absent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE RESTRICT,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
      FOREIGN KEY (location_id) REFERENCES attendance_locations(id) ON DELETE RESTRICT
    );

    -- DYNAMIC QR TOKENS HISTORY
    CREATE TABLE IF NOT EXISTS qr_tokens (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE
    );

    -- OTP SESSIONS
    CREATE TABLE IF NOT EXISTS otp_sessions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      attempt_count INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE
    );

    -- ATTENDANCE RECORDS (With unique database constraint on student_id + session_id)
    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'late', 'absent')),
      timestamp DATETIME NOT NULL,
      verification_method TEXT NOT NULL CHECK(verification_method IN ('staff_qr_scan', 'qr_face', 'qr_gps_otp', 'face_gps_otp', 'faculty_override')),
      gps_lat REAL,
      gps_lng REAL,
      gps_distance_meters REAL,
      ip_address TEXT,
      device_info TEXT,
      corrected_by TEXT,
      correction_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, session_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE
    );

    -- FACE BIOMETRIC TEMPLATES (Securely isolated, zero raw images)
    CREATE TABLE IF NOT EXISTS face_templates (
      id TEXT PRIMARY KEY,
      student_id TEXT UNIQUE NOT NULL,
      template_data TEXT NOT NULL, -- Encrypted JSON vector/embedding representation
      liveness_score REAL DEFAULT 0.95,
      consent_status INTEGER NOT NULL DEFAULT 1,
      consent_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- AUDIT LOGS / SECURITY MISUSE MONITOR
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_role TEXT,
      user_name TEXT,
      action TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'danger')),
      session_id TEXT,
      ip_address TEXT,
      device_info TEXT,
      description TEXT NOT NULL,
      metadata TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- FACULTY PROXY & SUBSTITUTE TEACHER REASSIGNMENTS
    CREATE TABLE IF NOT EXISTS faculty_proxies (
      id TEXT PRIMARY KEY,
      original_faculty_id TEXT NOT NULL,
      substitute_faculty_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      section_id TEXT,
      date TEXT NOT NULL,
      period_name TEXT DEFAULT 'Period 1',
      start_time DATETIME,
      end_time DATETIME,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'declined', 'completed', 'cancelled')),
      created_by_user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (original_faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
      FOREIGN KEY (substitute_faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );

    -- NOTIFICATIONS
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info' CHECK(type IN ('info', 'success', 'warning', 'danger')),
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- INDEXES FOR MAXIMUM QUERY SPEED & CONSTRAINT ENFORCEMENT
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
    CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id);
    CREATE INDEX IF NOT EXISTS idx_faculty_user ON faculty(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_class ON attendance_sessions(class_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON attendance_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_records_student ON attendance_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_records_session ON attendance_records(session_id);
    CREATE INDEX IF NOT EXISTS idx_records_timestamp ON attendance_records(timestamp);
    CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
  `);

  // Auto seed initial data if running in fresh environment
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
    if (userCount === 0) {
      const { seedDatabase } = require('./seed');
      seedDatabase();
    }
  } catch (e) {
    console.warn('Auto seed note:', e.message);
  }
}

initSchema();

module.exports = {
  db,
  initSchema
};

-- ========================================================================
-- SMART ATTENDANCE MANAGEMENT SYSTEM - SUPABASE POSTGRESQL SCHEMA
-- ZERO DEDICATED BIOMETRIC HARDWARE ARCHITECTURE
-- ========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ACADEMIC YEARS
CREATE TABLE IF NOT EXISTS academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year_number INT NOT NULL,
    label VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CLASSES
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SECTIONS
CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SUBJECTS
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    semester INT NOT NULL,
    credits INT DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    is_active INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. FACULTY PROFILES
CREATE TABLE IF NOT EXISTS faculty_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(100) UNIQUE NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    designation VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. STUDENT PROFILES
CREATE TABLE IF NOT EXISTS student_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    student_id VARCHAR(100) UNIQUE NOT NULL,
    roll_no VARCHAR(100) UNIQUE NOT NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    guardian_phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. FACE BIOMETRIC TEMPLATES (Zero Raw Image Storage - 128-d encrypted vector only)
CREATE TABLE IF NOT EXISTS face_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID UNIQUE REFERENCES student_profiles(id) ON DELETE CASCADE,
    template_data TEXT NOT NULL,
    liveness_score FLOAT DEFAULT 0.95,
    consent_status INT DEFAULT 1,
    consent_timestamp TIMESTAMPTZ DEFAULT NOW(),
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CAMPUS GEOFENCE LOCATIONS
CREATE TABLE IF NOT EXISTS attendance_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INT DEFAULT 150,
    is_active INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ATTENDANCE SESSIONS (Dynamic QR + Face + OTP + Geofence)
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id UUID REFERENCES faculty_profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
    location_id UUID REFERENCES attendance_locations(id) ON DELETE SET NULL,
    verification_mode VARCHAR(50) DEFAULT 'qr_otp',
    period_name VARCHAR(100),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    late_threshold_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
    current_otp_hash VARCHAR(255),
    current_otp_display VARCHAR(50),
    otp_expires_at TIMESTAMPTZ,
    current_qr_token VARCHAR(255),
    qr_expires_at TIMESTAMPTZ,
    total_expected INT DEFAULT 0,
    total_present INT DEFAULT 0,
    total_late INT DEFAULT 0,
    total_absent INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ATTENDANCE RECORDS
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'excused')),
    verification_method VARCHAR(50) NOT NULL,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    gps_distance_meters FLOAT,
    liveness_score FLOAT,
    face_similarity_score FLOAT,
    device_info TEXT,
    ip_address VARCHAR(100),
    is_manual_override INT DEFAULT 0,
    override_reason TEXT,
    override_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_student_session UNIQUE (session_id, student_id)
);

-- 13. ATTENDANCE RULES & POLICIES
CREATE TABLE IF NOT EXISTS attendance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_key VARCHAR(100) UNIQUE NOT NULL,
    rule_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. AUDIT & MISUSE DETECTION LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_role VARCHAR(50),
    user_name VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    severity VARCHAR(50) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'danger')),
    session_id UUID REFERENCES attendance_sessions(id) ON DELETE SET NULL,
    ip_address VARCHAR(100),
    device_info TEXT,
    description TEXT,
    metadata TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. SYSTEM NOTIFICATIONS
CREATE TABLE IF NOT EXISTS system_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read INT DEFAULT 0,
    link VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================================
-- INDEXES FOR FAST QUERYING
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_student_user ON student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_student_class ON student_profiles(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_status ON attendance_sessions(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- ========================================================================
-- SEED INSTITUTIONAL CONFIGURATION
-- ========================================================================
INSERT INTO attendance_rules (rule_key, rule_value, description) VALUES
('session_duration_minutes', '50', 'Standard lecture session duration in minutes'),
('qr_expiration_seconds', '15', 'Dynamic QR Code rotation interval in seconds'),
('otp_expiration_seconds', '600', 'Validity period of session 6-digit OTP code'),
('late_entry_minutes', '15', 'Grace period after lecture start before marked Late'),
('gps_radius_meters', '150', 'Permitted geofence radius around classroom quad'),
('max_otp_attempts', '5', 'Max OTP entry attempts before locking check-in'),
('max_face_attempts', '3', 'Max facial verification attempts before requiring faculty override'),
('min_attendance_percentage', '75', 'Minimum attendance percentage requirement')
ON CONFLICT (rule_key) DO NOTHING;

INSERT INTO attendance_locations (id, name, latitude, longitude, radius_meters, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'Apex Main Campus Academic Quad', 12.971598, 77.594562, 150, 1),
('22222222-2222-2222-2222-222222222222', 'Science & Engineering Complex', 12.972100, 77.595100, 120, 1),
('33333333-3333-3333-3333-333333333333', 'Central Computing & AI Lab', 12.971200, 77.593900, 80, 1)
ON CONFLICT (id) DO NOTHING;

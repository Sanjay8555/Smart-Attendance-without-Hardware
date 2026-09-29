const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'smart-attendance-super-secret-jwt-key-2026-prod',
  JWT_EXPIRES_IN: '24h',
  DB_PATH: process.env.VERCEL
    ? path.join('/tmp', 'attendance.db')
    : (process.env.DB_PATH || path.join(__dirname, '..', 'database', 'attendance.db')),
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_DB_URL: process.env.SUPABASE_DB_URL || '',
  DEFAULT_LOCATION: {
    name: 'Main Campus Academic Quad',
    latitude: 12.971598,
    longitude: 77.594562,
    radius_meters: 150
  },
  DEFAULT_RULES: {
    session_duration_minutes: '50',
    qr_expiration_seconds: '15',      // Dynamic rotating QR token
    otp_expiration_seconds: '600',    // 10 minutes OTP session validity
    late_entry_minutes: '15',         // 0-15 mins = Present, 15-30 mins = Late, >30 = rejected
    gps_radius_meters: '150',
    max_otp_attempts: '5',
    max_face_attempts: '3',
    min_attendance_percentage: '75',
    face_verification_enabled: 'true',
    liveness_check_required: 'true'
  }
};

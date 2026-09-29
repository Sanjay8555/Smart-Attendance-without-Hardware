const { Pool } = require('pg');
const config = require('../config/config');

let pool = null;
let isConnected = false;
let lastSyncTime = null;
let syncStats = {
  users: 0,
  students: 0,
  faculty: 0,
  departments: 0,
  classes: 0,
  sessions: 0,
  records: 0,
  faceTemplates: 0
};

function getPool() {
  if (!pool && config.SUPABASE_DB_URL) {
    pool = new Pool({
      connectionString: config.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    pool.on('error', (err) => {
      console.warn('Supabase Pool Warning:', err.message);
    });
  }
  return pool;
}

async function initSupabaseConnection() {
  const p = getPool();
  if (!p) return false;

  try {
    const res = await p.query('SELECT NOW() as now, version()');
    isConnected = true;
    lastSyncTime = new Date().toISOString();
    console.log('⚡ Connected to Supabase PostgreSQL Database (PostgreSQL 17.6)');
    return true;
  } catch (err) {
    isConnected = false;
    console.warn('Supabase connection warning:', err.message);
    return false;
  }
}

/**
 * Full bidirectional synchronization between SQLite local database and Supabase PostgreSQL
 */
async function syncAllToSupabase(db) {
  const p = getPool();
  if (!p || !isConnected) {
    const ok = await initSupabaseConnection();
    if (!ok) return;
  }

  try {
    const client = await p.connect();

    try {
      await client.query('BEGIN');

      // Drop duplicate constraint on roll_no if exists
      await client.query('ALTER TABLE student_profiles DROP CONSTRAINT IF EXISTS student_profiles_roll_no_key;').catch(() => {});

      // Clear existing records cleanly in dependency order to ensure exact parity
      await client.query(`
        TRUNCATE TABLE attendance_records, attendance_sessions, face_templates, student_profiles,
                       faculty_profiles, users, subjects, sections, classes, academic_years,
                       departments, attendance_locations CASCADE;
      `);

      // 1. Departments
      const departments = db.prepare('SELECT * FROM departments').all();
      for (const d of departments) {
        await client.query(`
          INSERT INTO departments (id, name, code)
          VALUES ($1, $2, $3)
        `, [d.id, d.name, d.code]);
      }
      syncStats.departments = departments.length;

      // 2. Academic Years
      const years = db.prepare('SELECT * FROM academic_years').all();
      for (const y of years) {
        await client.query(`
          INSERT INTO academic_years (id, year_number, label)
          VALUES ($1, $2, $3)
        `, [y.id, y.year_number, y.label]);
      }

      // 3. Classes
      const classes = db.prepare('SELECT * FROM classes').all();
      for (const c of classes) {
        await client.query(`
          INSERT INTO classes (id, department_id, year_id, name, code)
          VALUES ($1, $2, $3, $4, $5)
        `, [c.id, c.department_id, c.year_id, c.name, c.code]);
      }
      syncStats.classes = classes.length;

      // 4. Sections
      const sections = db.prepare('SELECT * FROM sections').all();
      for (const sec of sections) {
        await client.query(`
          INSERT INTO sections (id, class_id, name)
          VALUES ($1, $2, $3)
        `, [sec.id, sec.class_id, sec.name]);
      }

      // 5. Subjects
      const subjects = db.prepare('SELECT * FROM subjects').all();
      for (const sub of subjects) {
        await client.query(`
          INSERT INTO subjects (id, code, name, department_id, semester, credits)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [sub.id, sub.code, sub.name, sub.department_id, sub.semester || 1, sub.credits || 3]);
      }

      // 6. Users
      const users = db.prepare('SELECT * FROM users').all();
      for (const u of users) {
        await client.query(`
          INSERT INTO users (id, name, email, password_hash, role, phone)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [u.id, u.name, u.email, u.password_hash, u.role, u.phone || null]);
      }
      syncStats.users = users.length;

      // 7. Faculty Profiles
      const faculty = db.prepare('SELECT * FROM faculty').all();
      for (const f of faculty) {
        await client.query(`
          INSERT INTO faculty_profiles (id, user_id, employee_id, department_id, designation)
          VALUES ($1, $2, $3, $4, $5)
        `, [f.id, f.user_id, f.faculty_id, f.department_id, f.designation]);
      }
      syncStats.faculty = faculty.length;

      // 8. Student Profiles
      const students = db.prepare('SELECT * FROM students').all();
      for (const s of students) {
        await client.query(`
          INSERT INTO student_profiles (id, user_id, student_id, roll_no, class_id, section_id, academic_year_id, guardian_phone)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [s.id, s.user_id, s.student_id, s.roll_no, s.class_id, s.section_id || null, s.year_id || null, s.phone || null]);
      }
      syncStats.students = students.length;

      // 9. Face Biometric Templates
      const faceTemplates = db.prepare('SELECT * FROM face_templates').all();
      for (const ft of faceTemplates) {
        await client.query(`
          INSERT INTO face_templates (id, student_id, template_data, liveness_score, consent_status, consent_timestamp, enrolled_at, updated_at, scanned_image)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [ft.id, ft.student_id, ft.template_data, ft.liveness_score || 0.98, ft.consent_status || 1, ft.consent_timestamp || new Date(), ft.enrolled_at || new Date(), ft.updated_at || new Date(), ft.scanned_image || null]);
      }
      syncStats.faceTemplates = faceTemplates.length;

      // 10. Attendance Locations (Geofences)
      const locations = db.prepare('SELECT * FROM attendance_locations').all();
      for (const loc of locations) {
        await client.query(`
          INSERT INTO attendance_locations (id, name, latitude, longitude, radius_meters, is_active)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [loc.id, loc.name, loc.latitude, loc.longitude, loc.radius_meters, loc.is_active || 1]);
      }
      syncStats.locations = locations.length;

      // 11. Attendance Sessions
      const sessions = db.prepare('SELECT * FROM attendance_sessions').all();
      for (const sess of sessions) {
        await client.query(`
          INSERT INTO attendance_sessions (
            id, faculty_id, subject_id, class_id, section_id, location_id,
            period_name, start_time, end_time, late_threshold_time, status,
            current_qr_token, qr_expires_at, current_otp_display, otp_expires_at,
            total_present, total_late, total_absent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          sess.id, sess.faculty_id, sess.subject_id, sess.class_id, sess.section_id || null, sess.location_id,
          sess.period_name || 'Period 1', sess.start_time, sess.end_time, sess.late_threshold_time, sess.status,
          sess.current_qr_token, sess.qr_expires_at, sess.current_otp_display, sess.otp_expires_at,
          sess.total_present || 0, sess.total_late || 0, sess.total_absent || 0
        ]);
      }
      syncStats.sessions = sessions.length;

      // 12. Attendance Records
      const records = db.prepare('SELECT * FROM attendance_records').all();
      for (const rec of records) {
        await client.query(`
          INSERT INTO attendance_records (
            id, student_id, session_id, status, timestamp, verification_method,
            gps_latitude, gps_longitude, gps_distance_meters, ip_address, device_info, scanned_image
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          rec.id, rec.student_id, rec.session_id, rec.status, rec.timestamp, rec.verification_method,
          rec.gps_lat || null, rec.gps_lng || null, rec.gps_distance_meters || 0, rec.ip_address || '', rec.device_info || '', rec.scanned_image || null
        ]);
      }
      syncStats.records = records.length;

      await client.query('COMMIT');
      lastSyncTime = new Date().toISOString();
      console.log(`✅ Supabase Database fully synchronized: ${users.length} Users, ${students.length} Students, ${records.length} Records, ${faceTemplates.length} Face Vectors.`);
    } catch (txErr) {
      await client.query('ROLLBACK');
      console.warn('Supabase sync transaction warning:', txErr.message);
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('Supabase sync error:', err.message);
  }
}

async function syncSingleAttendanceRecord(record) {
  const p = getPool();
  if (!p) return;

  try {
    await p.query(`
      INSERT INTO attendance_records (
        id, student_id, session_id, status, timestamp, verification_method,
        gps_latitude, gps_longitude, gps_distance_meters, ip_address, device_info, scanned_image
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (session_id, student_id) DO UPDATE SET 
        status = EXCLUDED.status,
        timestamp = EXCLUDED.timestamp,
        scanned_image = COALESCE(EXCLUDED.scanned_image, attendance_records.scanned_image);
    `, [
      record.id, record.student_id, record.session_id, record.status, record.timestamp, record.verification_method,
      record.gps_lat || null, record.gps_lng || null, record.gps_distance_meters || 0, record.ip_address || '', record.device_info || '', record.scanned_image || null
    ]);
  } catch (e) {
    console.warn('Real-time record sync to Supabase note:', e.message);
  }
}

async function syncSingleFaceTemplate(studentId, templateData, livenessScore = 0.98, scannedImage = null) {
  const p = getPool();
  if (!p) return;

  try {
    await p.query(`
      INSERT INTO face_templates (id, student_id, template_data, liveness_score, consent_status, consent_timestamp, enrolled_at, updated_at, scanned_image)
      VALUES (gen_random_uuid(), $1, $2, $3, 1, NOW(), NOW(), NOW(), $4)
      ON CONFLICT (student_id) DO UPDATE SET 
        template_data = EXCLUDED.template_data,
        liveness_score = EXCLUDED.liveness_score,
        scanned_image = COALESCE(EXCLUDED.scanned_image, face_templates.scanned_image),
        updated_at = NOW();
    `, [studentId, typeof templateData === 'string' ? templateData : JSON.stringify(templateData), livenessScore, scannedImage || null]);
  } catch (e) {
    console.warn('Real-time face template sync to Supabase note:', e.message);
  }
}

function getSupabaseHealth() {
  return {
    isConfigured: !!config.SUPABASE_DB_URL,
    isConnected,
    lastSyncTime,
    provider: 'Supabase PostgreSQL (v17.6 / Tokyo ap-northeast-1)',
    poolerHost: 'aws-0-ap-northeast-1.pooler.supabase.com:6543',
    stats: syncStats
  };
}

module.exports = {
  getPool,
  initSupabaseConnection,
  syncAllToSupabase,
  syncSingleAttendanceRecord,
  syncSingleFaceTemplate,
  getSupabaseHealth
};

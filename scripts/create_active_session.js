const { db } = require('../server/database/db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getPool, initSupabaseConnection } = require('../server/database/supabaseSync');

async function createActiveSession() {
  const sessionId = uuidv4();
  
  // Faculty: Prof. Rajesh Sharma
  const faculty = db.prepare('SELECT id FROM faculty WHERE id = ?').get('c6a1270b-cc24-4d18-b1c6-722ab4e6bd9d') || db.prepare('SELECT id FROM faculty LIMIT 1').get();
  // Subject: Database Management Systems (CS301)
  const subject = db.prepare('SELECT id FROM subjects WHERE code = ?').get('CS301') || db.prepare('SELECT id FROM subjects LIMIT 1').get();
  // Class: CSE-3A
  const classObj = db.prepare('SELECT id FROM classes WHERE code = ?').get('CSE-3A') || db.prepare('SELECT id FROM classes LIMIT 1').get();
  // Location: Apex Main Campus Academic Quad
  const location = db.prepare('SELECT id FROM attendance_locations LIMIT 1').get();

  // Timing: 3:00 PM to 5:00 PM on 2026-09-29 (Local Time IST)
  const startTime = new Date('2026-09-29T15:00:00+05:30').toISOString();
  const endTime = new Date('2026-09-29T17:00:00+05:30').toISOString();
  const lateThreshold = new Date('2026-09-29T15:30:00+05:30').toISOString();

  const rawOtp = '582914';
  const otpHash = crypto.createHash('sha256').update(rawOtp + sessionId).digest('hex');
  const qrToken = 'QR-SES-' + crypto.randomBytes(8).toString('hex').toUpperCase();

  // Count expected students in CSE-3A
  const expectedCount = db.prepare('SELECT COUNT(*) as count FROM students WHERE class_id = ?').get(classObj.id)?.count || 10;

  // Insert into SQLite
  db.prepare(`
    INSERT INTO attendance_sessions (
      id, faculty_id, subject_id, class_id, location_id,
      attendance_mode, allow_face_fallback, period_name,
      start_time, end_time, late_threshold_time, status,
      current_otp_hash, current_otp_display, otp_expires_at,
      current_qr_token, qr_expires_at,
      total_expected, total_present, total_late, total_absent, created_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      'qr_face_otp', 1, 'Period 4 & 5 (3:00 PM - 5:00 PM)',
      ?, ?, ?, 'active',
      ?, ?, ?,
      ?, ?,
      ?, 0, 0, 0, ?
    )
  `).run(
    sessionId, faculty.id, subject.id, classObj.id, location.id,
    startTime, endTime, lateThreshold,
    otpHash, rawOtp, endTime,
    qrToken, endTime,
    expectedCount, startTime
  );

  console.log('✅ SQLite: Created active session for 3:00 PM - 5:00 PM:', sessionId);

  // Sync to Supabase PostgreSQL
  await initSupabaseConnection();
  const pool = getPool();
  if (pool) {
    await pool.query(`
      INSERT INTO attendance_sessions (
        id, faculty_id, subject_id, class_id, location_id,
        period_name, start_time, end_time, late_threshold_time, status,
        current_qr_token, qr_expires_at, current_otp_display, otp_expires_at,
        total_expected, total_present, total_late, total_absent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 0, 0, 0)
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, end_time = EXCLUDED.end_time;
    `, [
      sessionId, faculty.id, subject.id, classObj.id, location.id,
      'Period 4 & 5 (3:00 PM - 5:00 PM)', startTime, endTime, lateThreshold, 'active',
      qrToken, endTime, rawOtp, endTime,
      expectedCount
    ]);
    console.log('✅ Supabase PostgreSQL: Synced active session');
    await pool.end();
  }

  // Print session details
  const created = db.prepare(`
    SELECT s.id, s.period_name, s.start_time, s.end_time, s.status, s.current_otp_display, s.current_qr_token,
           sub.name as subject_name, sub.code as subject_code,
           c.name as class_name,
           u.name as faculty_name,
           loc.name as location_name
    FROM attendance_sessions s
    JOIN subjects sub ON s.subject_id = sub.id
    JOIN classes c ON s.class_id = c.id
    JOIN faculty f ON s.faculty_id = f.id
    JOIN users u ON f.user_id = u.id
    JOIN attendance_locations loc ON s.location_id = loc.id
    WHERE s.id = ?
  `).get(sessionId);

  console.log('SESSION_DETAILS:', JSON.stringify(created, null, 2));
}

createActiveSession().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

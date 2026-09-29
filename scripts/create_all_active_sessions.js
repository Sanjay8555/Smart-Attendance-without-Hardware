const { db } = require('../server/database/db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getPool, initSupabaseConnection } = require('../server/database/supabaseSync');

async function createAllActiveSessions() {
  const classes = db.prepare('SELECT id, name, code FROM classes').all();
  const subjects = db.prepare('SELECT id, name, code FROM subjects').all();
  const facultyList = db.prepare('SELECT id FROM faculty').all();
  const location = db.prepare('SELECT id FROM attendance_locations LIMIT 1').get();

  const startTime = new Date('2026-09-29T15:00:00+05:30').toISOString();
  const endTime = new Date('2026-09-29T17:00:00+05:30').toISOString();
  const lateThreshold = new Date('2026-09-29T15:30:00+05:30').toISOString();

  await initSupabaseConnection();
  const pool = getPool();

  const createdSessions = [];

  for (let i = 0; i < classes.length; i++) {
    const cls = classes[i];
    const subj = subjects[i % subjects.length];
    const fac = facultyList[i % facultyList.length];

    // Check if an active session already exists for this class
    const existing = db.prepare('SELECT id FROM attendance_sessions WHERE class_id = ? AND status = ?').get(cls.id, 'active');
    
    let sessionId = existing ? existing.id : uuidv4();
    const rawOtp = '58291' + (i + 1);
    const otpHash = crypto.createHash('sha256').update(rawOtp + sessionId).digest('hex');
    const qrToken = 'QR-' + cls.code.replace('-', '') + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    const expectedCount = db.prepare('SELECT COUNT(*) as count FROM students WHERE class_id = ?').get(cls.id)?.count || 5;

    if (existing) {
      db.prepare(`
        UPDATE attendance_sessions 
        SET start_time = ?, end_time = ?, late_threshold_time = ?, current_otp_hash = ?, current_otp_display = ?, otp_expires_at = ?, current_qr_token = ?, qr_expires_at = ?, status = 'active'
        WHERE id = ?
      `).run(startTime, endTime, lateThreshold, otpHash, rawOtp, endTime, qrToken, endTime, sessionId);
    } else {
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
        sessionId, fac.id, subj.id, cls.id, location.id,
        startTime, endTime, lateThreshold,
        otpHash, rawOtp, endTime,
        qrToken, endTime,
        expectedCount, startTime
      );
    }

    if (pool) {
      await pool.query(`
        INSERT INTO attendance_sessions (
          id, faculty_id, subject_id, class_id, location_id,
          period_name, start_time, end_time, late_threshold_time, status,
          current_qr_token, qr_expires_at, current_otp_display, otp_expires_at,
          total_expected, total_present, total_late, total_absent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 0, 0, 0)
        ON CONFLICT (id) DO UPDATE SET 
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          late_threshold_time = EXCLUDED.late_threshold_time,
          status = 'active',
          current_qr_token = EXCLUDED.current_qr_token,
          current_otp_display = EXCLUDED.current_otp_display;
      `, [
        sessionId, fac.id, subj.id, cls.id, location.id,
        'Period 4 & 5 (3:00 PM - 5:00 PM)', startTime, endTime, lateThreshold, 'active',
        qrToken, endTime, rawOtp, endTime,
        expectedCount
      ]);
    }

    createdSessions.push({
      sessionId,
      class: cls.name,
      subject: subj.name,
      subjectCode: subj.code,
      otp: rawOtp,
      qrToken
    });
  }

  if (pool) await pool.end();

  console.log('✅ All active sessions for 3:00 PM - 5:00 PM created & synced:');
  console.log(JSON.stringify(createdSessions, null, 2));
}

createAllActiveSessions().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });

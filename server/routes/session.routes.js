const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateQrToken } = require('../services/qrToken.service');
const { generateOtp } = require('../services/otp.service');
const { logAuditEvent } = require('../services/misuseDetection.service');

// Helper to get io instance
function getSocketIo(req) {
  return req.app.get('io');
}

// POST /api/session/start (Faculty starts attendance session)
router.post('/start', authenticate, requireRole('faculty'), (req, res) => {
  const {
    subject_id,
    class_id,
    section_id,
    location_id,
    period_name,
    attendance_mode = 'qr_otp',
    allow_face_fallback = true,
    duration_minutes = 45
  } = req.body;

  const faculty = req.faculty;
  if (!faculty) {
    return res.status(403).json({ success: false, message: 'Faculty profile not found.' });
  }

  if (!subject_id || !class_id || !location_id) {
    return res.status(400).json({ success: false, message: 'Subject, Class, and Campus Location are required.' });
  }

  // Count total enrolled students in this class
  const classCount = db.prepare(`SELECT COUNT(*) as count FROM students WHERE class_id = ?`).get(class_id);
  const totalExpected = classCount ? classCount.count : 0;

  const sessionId = uuidv4();
  const now = new Date();
  const durationMs = (parseInt(duration_minutes) || 45) * 60 * 1000;
  const endTime = new Date(now.getTime() + durationMs);

  // Late threshold (e.g. 15 mins from start)
  const lateMinutes = parseInt(db.prepare(`SELECT value FROM attendance_settings WHERE key = 'late_entry_minutes'`).get()?.value || '15');
  const lateThreshold = new Date(now.getTime() + lateMinutes * 60 * 1000);

  // Generate initial OTP and QR token
  const initialOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const initialOtpHashed = bcrypt.hashSync(initialOtp, 10);
  const otpExpires = new Date(now.getTime() + 10 * 60 * 1000);

  const initialQrToken = `ATT_QR_${sessionId.substring(0, 8)}_${uuidv4().substring(0, 8).toUpperCase()}`;
  const qrExpires = new Date(now.getTime() + 15 * 1000);

  const tx = db.transaction(() => {
    // Close any previous active session by this faculty if open
    db.prepare(`
      UPDATE attendance_sessions
      SET status = 'closed'
      WHERE faculty_id = ? AND status = 'active'
    `).run(faculty.id);

    // Create attendance session
    db.prepare(`
      INSERT INTO attendance_sessions (
        id, faculty_id, subject_id, class_id, section_id, location_id,
        attendance_mode, allow_face_fallback, period_name, start_time, end_time,
        late_threshold_time, status, current_otp_hash, current_otp_display, otp_expires_at,
        current_qr_token, qr_expires_at, total_expected, total_present, total_late, total_absent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, 0, 0, ?)
    `).run(
      sessionId,
      faculty.id,
      subject_id,
      class_id,
      section_id || null,
      location_id,
      attendance_mode,
      allow_face_fallback ? 1 : 0,
      period_name || 'Period 1',
      now.toISOString(),
      endTime.toISOString(),
      lateThreshold.toISOString(),
      initialOtpHashed,
      initialOtp,
      otpExpires.toISOString(),
      initialQrToken,
      qrExpires.toISOString(),
      totalExpected,
      totalExpected
    );

    // Insert QR token
    db.prepare(`
      INSERT INTO qr_tokens (id, session_id, token, expires_at, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(uuidv4(), sessionId, initialQrToken, qrExpires.toISOString());

    // Insert OTP session
    db.prepare(`
      INSERT INTO otp_sessions (id, session_id, otp_hash, expires_at, attempt_count)
      VALUES (?, ?, ?, ?, 0)
    `).run(uuidv4(), sessionId, initialOtpHashed, otpExpires.toISOString());
  });

  tx();

  // Notify students in that class
  const students = db.prepare(`SELECT user_id FROM students WHERE class_id = ?`).all(class_id);
  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, link)
    VALUES (?, ?, ?, ?, 'info', '/student')
  `);
  students.forEach(st => {
    insertNotif.run(
      uuidv4(),
      st.user_id,
      'Live Attendance Started!',
      `Attendance is now active for your class. Please scan QR or use Face Fallback.`,
      'info'
    );
  });

  logAuditEvent({
    userId: req.user.id,
    userRole: 'faculty',
    userName: req.user.name,
    action: 'SESSION_STARTED',
    sessionId,
    ipAddress: req.ip,
    description: `Faculty started live attendance session for class.`
  });

  // Socket broadcast
  const io = getSocketIo(req);
  if (io) {
    io.emit('SESSION_STARTED', { sessionId, classId: class_id });
  }

  return res.json({
    success: true,
    message: 'Live attendance session launched successfully.',
    sessionId,
    otp: initialOtp,
    qrToken: initialQrToken
  });
});

// GET /api/session/public/active (Public list of ongoing live sessions for students)
router.get('/public/active', (req, res) => {
  const activeSessions = db.prepare(`
    SELECT asess.id, asess.class_id, asess.start_time, asess.end_time, asess.status, asess.current_qr_token,
           sub.name as subject_name, sub.code as subject_code,
           c.name as class_name, loc.name as location_name,
           u.name as faculty_name, f.faculty_id as staff_id
    FROM attendance_sessions asess
    JOIN subjects sub ON asess.subject_id = sub.id
    JOIN classes c ON asess.class_id = c.id
    JOIN attendance_locations loc ON asess.location_id = loc.id
    JOIN faculty f ON asess.faculty_id = f.id
    JOIN users u ON f.user_id = u.id
    WHERE asess.status = 'active'
    ORDER BY asess.created_at DESC
  `).all();

  return res.json({ success: true, activeSessions });
});

// GET /api/session/active (Role-aware active session query)
router.get('/active', authenticate, (req, res) => {
  let session = null;

  if (req.user.role === 'faculty') {
    session = db.prepare(`
      SELECT asess.*, sub.name as subject_name, sub.code as subject_code,
             c.name as class_name, loc.name as location_name, loc.latitude as location_lat,
             loc.longitude as location_lng, loc.radius_meters as location_radius,
             u.name as faculty_name
      FROM attendance_sessions asess
      JOIN subjects sub ON asess.subject_id = sub.id
      JOIN classes c ON asess.class_id = c.id
      JOIN attendance_locations loc ON asess.location_id = loc.id
      JOIN faculty f ON asess.faculty_id = f.id
      JOIN users u ON f.user_id = u.id
      WHERE asess.faculty_id = ? AND asess.status = 'active'
      ORDER BY asess.created_at DESC
      LIMIT 1
    `).get(req.faculty.id);
  } else if (req.user.role === 'student') {
    if (!req.student) {
      return res.json({ success: true, activeSessions: [] });
    }
    const sessions = db.prepare(`
      SELECT asess.*, sub.name as subject_name, sub.code as subject_code,
             c.name as class_name, loc.name as location_name, loc.latitude as location_lat,
             loc.longitude as location_lng, loc.radius_meters as location_radius,
             u.name as faculty_name,
             (SELECT status FROM attendance_records ar WHERE ar.session_id = asess.id AND ar.student_id = ?) as student_attendance_status,
             (SELECT timestamp FROM attendance_records ar WHERE ar.session_id = asess.id AND ar.student_id = ?) as student_marked_at
      FROM attendance_sessions asess
      JOIN subjects sub ON asess.subject_id = sub.id
      JOIN classes c ON asess.class_id = c.id
      JOIN attendance_locations loc ON asess.location_id = loc.id
      JOIN faculty f ON asess.faculty_id = f.id
      JOIN users u ON f.user_id = u.id
      WHERE asess.class_id = ? AND asess.status = 'active'
      ORDER BY asess.created_at DESC
    `).all(req.student.id, req.student.id, req.student.class_id);

    return res.json({ success: true, activeSessions: sessions });
  } else {
    // Admin sees all active sessions
    const activeSessions = db.prepare(`
      SELECT asess.*, sub.name as subject_name, sub.code as subject_code,
             c.name as class_name, loc.name as location_name, u.name as faculty_name
      FROM attendance_sessions asess
      JOIN subjects sub ON asess.subject_id = sub.id
      JOIN classes c ON asess.class_id = c.id
      JOIN attendance_locations loc ON asess.location_id = loc.id
      JOIN faculty f ON asess.faculty_id = f.id
      JOIN users u ON f.user_id = u.id
      WHERE asess.status = 'active'
      ORDER BY asess.created_at DESC
    `).all();

    return res.json({ success: true, activeSessions });
  }

  return res.json({ success: true, session });
});

// GET /api/session/:id (Get full session details)
router.get('/:id', authenticate, (req, res) => {
  const { id } = req.params;

  const session = db.prepare(`
    SELECT asess.*, sub.name as subject_name, sub.code as subject_code,
           c.name as class_name, loc.name as location_name, loc.latitude as location_lat,
           loc.longitude as location_lng, loc.radius_meters as location_radius,
           u.name as faculty_name
    FROM attendance_sessions asess
    JOIN subjects sub ON asess.subject_id = sub.id
    JOIN classes c ON asess.class_id = c.id
    JOIN attendance_locations loc ON asess.location_id = loc.id
    JOIN faculty f ON asess.faculty_id = f.id
    JOIN users u ON f.user_id = u.id
    WHERE asess.id = ?
  `).get(id);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  // If student is requesting, do not expose plain OTP or internal token details
  if (req.user.role === 'student') {
    const studentStatus = db.prepare(`
      SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?
    `).get(id, req.student?.id);

    const safeSession = { ...session };
    delete safeSession.current_otp_hash;
    delete safeSession.current_otp_display;
    delete safeSession.current_qr_token;

    return res.json({
      success: true,
      session: safeSession,
      studentAttendance: studentStatus || null
    });
  }

  return res.json({ success: true, session });
});

// POST /api/session/:id/rotate-qr (Rotates the QR token)
router.post('/:id/rotate-qr', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const { id } = req.params;
  const qrResult = generateQrToken(id, 15);

  const io = getSocketIo(req);
  if (io) {
    io.to(`session_${id}`).emit('QR_ROTATED', {
      sessionId: id,
      qrToken: qrResult.token,
      expiresAt: qrResult.expiresAt
    });
  }

  return res.json({ success: true, ...qrResult });
});

// POST /api/session/:id/regenerate-otp
router.post('/:id/regenerate-otp', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const { id } = req.params;
  const otpResult = generateOtp(id, 600);

  const io = getSocketIo(req);
  if (io) {
    io.to(`session_${id}`).emit('OTP_UPDATED', {
      sessionId: id,
      otp: otpResult.otp
    });
  }

  return res.json({ success: true, ...otpResult });
});

// POST /api/session/:id/pause
router.post('/:id/pause', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const { id } = req.params;
  db.prepare(`UPDATE attendance_sessions SET status = 'paused' WHERE id = ?`).run(id);

  const io = getSocketIo(req);
  if (io) {
    io.to(`session_${id}`).emit('SESSION_STATUS_CHANGED', { sessionId: id, status: 'paused' });
  }

  return res.json({ success: true, message: 'Attendance session paused.' });
});

// POST /api/session/:id/resume
router.post('/:id/resume', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const { id } = req.params;
  db.prepare(`UPDATE attendance_sessions SET status = 'active' WHERE id = ?`).run(id);

  const io = getSocketIo(req);
  if (io) {
    io.to(`session_${id}`).emit('SESSION_STATUS_CHANGED', { sessionId: id, status: 'active' });
  }

  return res.json({ success: true, message: 'Attendance session resumed.' });
});

// POST /api/session/:id/close
router.post('/:id/close', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const { id } = req.params;

  const session = db.prepare(`SELECT * FROM attendance_sessions WHERE id = ?`).get(id);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  // Finalize attendance counts: Present, Late, Absent
  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count
    FROM attendance_records
    WHERE session_id = ?
  `).get(id);

  const present = counts.present_count || 0;
  const late = counts.late_count || 0;
  const totalAttended = present + late;
  const absent = Math.max(0, session.total_expected - totalAttended);

  db.prepare(`
    UPDATE attendance_sessions
    SET status = 'closed',
        total_present = ?,
        total_late = ?,
        total_absent = ?,
        end_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(present, late, absent, id);

  logAuditEvent({
    userId: req.user.id,
    userRole: req.user.role,
    userName: req.user.name,
    action: 'SESSION_CLOSED',
    sessionId: id,
    ipAddress: req.ip,
    description: `Session closed. Summary: ${present} Present, ${late} Late, ${absent} Absent.`
  });

  const io = getSocketIo(req);
  if (io) {
    io.to(`session_${id}`).emit('SESSION_CLOSED', { sessionId: id, present, late, absent });
  }

  return res.json({
    success: true,
    message: 'Attendance session closed and finalized.',
    summary: { present, late, absent, totalExpected: session.total_expected }
  });
});

// GET /api/session/:id/attendees (Live attendees list for faculty/admin)
router.get('/:id/attendees', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const { id } = req.params;

  const session = db.prepare(`SELECT class_id FROM attendance_sessions WHERE id = ?`).get(id);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  // Fetch all students of class and left join their attendance record
  const attendees = db.prepare(`
    SELECT s.id as student_id, s.roll_no, s.student_id as student_code,
           u.name as student_name, u.email as student_email,
           ar.id as record_id, ar.status, ar.timestamp as marked_at,
           ar.verification_method, ar.gps_distance_meters, ar.ip_address,
           ar.corrected_by, ar.correction_reason
    FROM students s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.session_id = ?
    WHERE s.class_id = ?
    ORDER BY s.roll_no ASC
  `).all(id, session.class_id);

  const formatted = attendees.map(a => ({
    ...a,
    status: a.status || 'absent'
  }));

  return res.json({ success: true, count: formatted.length, data: formatted });
});

module.exports = router;

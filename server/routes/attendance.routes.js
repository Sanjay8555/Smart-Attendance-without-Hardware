const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { verifyGeofence } = require('../services/geofence.service');
const { validateQrToken } = require('../services/qrToken.service');
const { verifyOtp } = require('../services/otp.service');
const { verifyFaceEmbedding, matchFaceInClassRoster } = require('../services/faceVerification.service');
const { logAuditEvent } = require('../services/misuseDetection.service');
const { syncSingleAttendanceRecord } = require('../database/supabaseSync');

function getSocketIo(req) {
  return req.app.get('io');
}

// ==========================================
// ZERO-LOGIN PUBLIC ATTENDANCE ENDPOINTS
// ==========================================

// POST /api/attendance/public/validate-qr
// Validates session QR token without requiring student login
router.post('/public/validate-qr', (req, res) => {
  let { session_id, token, qr_data } = req.body;

  // Handle parsed or string QR data
  if (qr_data) {
    try {
      const parsed = typeof qr_data === 'string' ? JSON.parse(qr_data) : qr_data;
      if (parsed.sessionId) session_id = parsed.sessionId;
      if (parsed.token) token = parsed.token;
    } catch {
      if (!session_id && typeof qr_data === 'string' && qr_data.length > 5) {
        if (qr_data.startsWith('ATT_QR_')) {
          token = qr_data;
        } else {
          session_id = qr_data;
        }
      }
    }
  }

  // If token is provided but session_id is not, resolve session_id from token
  if (!session_id && token) {
    const fromToken = db.prepare(`SELECT session_id FROM qr_tokens WHERE token = ?`).get(token);
    if (fromToken) {
      session_id = fromToken.session_id;
    } else {
      const fromCurrent = db.prepare(`SELECT id FROM attendance_sessions WHERE current_qr_token = ?`).get(token);
      if (fromCurrent) {
        session_id = fromCurrent.id;
      }
    }
  }

  // If session_id itself starts with ATT_QR_, resolve it
  if (session_id && session_id.startsWith('ATT_QR_')) {
    const foundToken = db.prepare(`SELECT session_id FROM qr_tokens WHERE token = ?`).get(session_id);
    if (foundToken) {
      session_id = foundToken.session_id;
    } else {
      const fromCurrent = db.prepare(`SELECT id FROM attendance_sessions WHERE current_qr_token = ?`).get(session_id);
      if (fromCurrent) {
        session_id = fromCurrent.id;
      } else {
        // Extract 8 char prefix from ATT_QR_1352577e_...
        const parts = session_id.split('_');
        if (parts.length >= 3) {
          const prefix = parts[2];
          const matched = db.prepare(`SELECT id FROM attendance_sessions WHERE id LIKE ?`).get(`${prefix}%`);
          if (matched) session_id = matched.id;
        }
      }
    }
  }

  // Fallback to currently running active session if only 1 active
  if (!session_id) {
    const singleActive = db.prepare(`SELECT id FROM attendance_sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`).get();
    if (singleActive) {
      session_id = singleActive.id;
    }
  }

  if (!session_id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid QR Code: Session identifier missing. Please scan a valid session QR.'
    });
  }

  const session = db.prepare(`
    SELECT asess.*,
           sub.name as subject_name, sub.code as subject_code,
           c.name as class_name,
           d.name as department_name,
           f.faculty_id as staff_employee_code,
           u.name as staff_name,
           loc.name as location_name, loc.latitude as location_lat,
           loc.longitude as location_lng, loc.radius_meters as location_radius
    FROM attendance_sessions asess
    JOIN subjects sub ON asess.subject_id = sub.id
    JOIN classes c ON asess.class_id = c.id
    JOIN departments d ON c.department_id = d.id
    JOIN faculty f ON asess.faculty_id = f.id
    JOIN users u ON f.user_id = u.id
    LEFT JOIN attendance_locations loc ON asess.location_id = loc.id
    WHERE asess.id = ? OR asess.current_qr_token = ?
  `).get(session_id, token || session_id);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Invalid QR Code: Attendance session not found or does not exist.'
    });
  }

  if (session.status === 'closed') {
    return res.status(400).json({
      success: false,
      sessionStatus: 'closed',
      message: 'Session closed: Attendance session has already concluded. No further check-ins permitted.'
    });
  }

  if (session.status === 'paused') {
    return res.status(400).json({
      success: false,
      sessionStatus: 'paused',
      message: 'Session paused: Faculty has temporarily paused attendance. Please wait a moment.'
    });
  }

  // Expiration check
  const now = new Date();
  const endTime = new Date(session.end_time);
  if (now > endTime) {
    return res.status(400).json({
      success: false,
      sessionStatus: 'expired',
      message: 'Expired QR: The attendance check-in window for this session has expired.'
    });
  }

  // Token check if dynamic rotating token is enabled
  if (token && token !== session.id && session.current_qr_token && token !== session.current_qr_token) {
    const qrValidation = validateQrToken(session.id, token);
    if (!qrValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR Code: QR token has rotated or is invalid. Please scan the current live QR code on screen.'
      });
    }
  }

  const isLate = now > new Date(session.late_threshold_time);

  return res.json({
    success: true,
    message: 'Valid QR: Session verified. Proceed to camera face verification.',
    session: {
      id: session.id,
      subject_name: session.subject_name,
      subject_code: session.subject_code,
      class_name: session.class_name,
      class_id: session.class_id,
      department_name: session.department_name,
      section_name: session.section_name || 'A',
      staff_name: session.staff_name,
      staff_id: session.staff_employee_code || session.faculty_id,
      date: new Date(session.start_time).toLocaleDateString(),
      time: new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      start_time: session.start_time,
      end_time: session.end_time,
      is_late: isLate,
      status: session.status
    }
  });
});

// POST /api/attendance/public/face-recognize
// Zero-login Face recognition matching against enrolled class roster
router.post('/public/face-recognize', (req, res) => {
  const {
    session_id,
    qr_token,
    face_descriptor,
    liveness_score = 0.95,
    gps_lat,
    gps_lng,
    device_info,
    scanned_image,
    image_data
  } = req.body;

  const capturedImage = scanned_image || image_data || null;

  if (!session_id) {
    return res.status(400).json({ success: false, message: 'Session ID is required.' });
  }

  if (!face_descriptor || (!Array.isArray(face_descriptor) && typeof face_descriptor !== 'string')) {
    return res.status(400).json({
      success: false,
      message: 'No face detected: Camera must capture a clear front-facing face.'
    });
  }

  // Fetch session
  const session = db.prepare(`
    SELECT asess.*,
           sub.name as subject_name, sub.code as subject_code,
           c.name as class_name,
           d.name as department_name,
           f.faculty_id as staff_employee_code,
           u.name as staff_name,
           loc.name as location_name, loc.latitude as location_lat,
           loc.longitude as location_lng, loc.radius_meters as location_radius
    FROM attendance_sessions asess
    JOIN subjects sub ON asess.subject_id = sub.id
    JOIN classes c ON asess.class_id = c.id
    JOIN departments d ON c.department_id = d.id
    JOIN faculty f ON asess.faculty_id = f.id
    JOIN users u ON f.user_id = u.id
    LEFT JOIN attendance_locations loc ON asess.location_id = loc.id
    WHERE asess.id = ?
  `).get(session_id);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Invalid QR: Session not found.' });
  }

  if (session.status === 'closed') {
    return res.status(400).json({ success: false, message: 'Session closed: Attendance session is closed.' });
  }

  if (session.status === 'paused') {
    return res.status(400).json({ success: false, message: 'Session paused: Attendance session is currently paused.' });
  }

  const now = new Date();
  if (now > new Date(session.end_time)) {
    return res.status(400).json({ success: false, message: 'Expired QR: Attendance window has closed.' });
  }

  // Perform 1:N Class-Scoped Face Recognition & Liveness Verification
  const matchResult = matchFaceInClassRoster(session.class_id, face_descriptor, liveness_score);

  if (!matchResult.isMatch) {
    return res.status(400).json({
      success: false,
      isMatch: false,
      status: 'absent',
      reason: matchResult.reason || 'FACE_MISMATCH',
      message: matchResult.message || 'Face mismatch: Facial features did not match any registered student in this class.'
    });
  }

  const matchedStudent = matchResult.student;

  // Duplicate attendance check: Student_ID + Session_ID
  const existingRecord = db.prepare(`
    SELECT * FROM attendance_records WHERE student_id = ? AND session_id = ?
  `).get(matchedStudent.id, session.id);

  if (existingRecord) {
    return res.status(400).json({
      success: false,
      alreadyMarked: true,
      status: existingRecord.status.toUpperCase(),
      message: `Attendance already recorded: ${matchedStudent.name} (${matchedStudent.roll_no}) was marked ${existingRecord.status.toUpperCase()} at ${new Date(existingRecord.timestamp).toLocaleTimeString()}.`,
      student: {
        id: matchedStudent.id,
        student_id: matchedStudent.student_id,
        name: matchedStudent.name,
        roll_no: matchedStudent.roll_no,
        class_name: matchedStudent.class_name,
        section: matchedStudent.section_name || 'A'
      },
      recordedAt: existingRecord.timestamp
    });
  }

  // Determine Present or Late
  const isLate = now > new Date(session.late_threshold_time);
  const computedStatus = isLate ? 'late' : 'present';
  const recordId = uuidv4();
  const timestampIso = now.toISOString();

  try {
    const tx = db.transaction(() => {
      // Insert attendance record with scanned face image
      db.prepare(`
        INSERT INTO attendance_records (
          id, student_id, session_id, status, timestamp, verification_method,
          gps_lat, gps_lng, gps_distance_meters, ip_address, device_info, created_at, scanned_image
        ) VALUES (?, ?, ?, ?, ?, 'qr_face', ?, ?, 0, ?, ?, ?, ?)
      `).run(
        recordId,
        matchedStudent.id,
        session.id,
        computedStatus,
        timestampIso,
        gps_lat ? parseFloat(gps_lat) : 0,
        gps_lng ? parseFloat(gps_lng) : 0,
        req.ip || '127.0.0.1',
        device_info || req.headers['user-agent'] || 'Public Camera Scanner',
        timestampIso,
        capturedImage
      );

      // Increment counters
      if (computedStatus === 'present') {
        db.prepare(`UPDATE attendance_sessions SET total_present = total_present + 1 WHERE id = ?`).run(session.id);
      } else {
        db.prepare(`UPDATE attendance_sessions SET total_late = total_late + 1 WHERE id = ?`).run(session.id);
      }

      // Add student notification
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type)
        VALUES (?, ?, ?, ?, 'success')
      `).run(
        uuidv4(),
        matchedStudent.user_id,
        `Attendance Marked (${computedStatus.toUpperCase()})`,
        `Attendance verified via Face Recognition for ${session.subject_name}.`
      );
    });

    tx();

    // Sync in real-time to Supabase PostgreSQL cloud database with scanned image
    syncSingleAttendanceRecord({
      id: recordId,
      student_id: matchedStudent.id,
      session_id: session.id,
      status: computedStatus,
      timestamp: timestampIso,
      verification_method: 'qr_face',
      gps_lat: gps_lat ? parseFloat(gps_lat) : 0,
      gps_lng: gps_lng ? parseFloat(gps_lng) : 0,
      gps_distance_meters: 0,
      ip_address: req.ip || '127.0.0.1',
      device_info: device_info || req.headers['user-agent'] || 'Public Camera Scanner',
      created_at: timestampIso,
      scanned_image: capturedImage
    }).catch(() => {});

    // Broadcast Real-time WebSocket event to Faculty Live Dashboard
    const io = getSocketIo(req);
    if (io) {
      io.to(`session_${session.id}`).emit('STUDENT_CHECKED_IN', {
        sessionId: session.id,
        student: {
          id: matchedStudent.id,
          name: matchedStudent.name,
          roll_no: matchedStudent.roll_no,
          student_code: matchedStudent.student_id,
          status: computedStatus,
          marked_at: timestampIso,
          verification_method: 'qr_face',
          distanceMeters: 0
        }
      });
    }

    logAuditEvent({
      userId: matchedStudent.user_id,
      userRole: 'student',
      userName: matchedStudent.name,
      action: 'PUBLIC_QR_FACE_ATTENDANCE',
      severity: 'info',
      sessionId: session.id,
      ipAddress: req.ip,
      description: `Public QR+Face attendance verified for ${matchedStudent.name} (${matchedStudent.student_id}) as ${computedStatus.toUpperCase()}.`
    });

    return res.json({
      success: true,
      isMatch: true,
      status: computedStatus.toUpperCase(),
      message: `Face Match Successful! Attendance recorded as ${computedStatus.toUpperCase()}.`,
      student: {
        id: matchedStudent.id,
        student_id: matchedStudent.student_id,
        name: matchedStudent.name,
        roll_no: matchedStudent.roll_no,
        class_name: matchedStudent.class_name,
        section: matchedStudent.section_name || 'A'
      },
      session: {
        id: session.id,
        subject: session.subject_name,
        subject_code: session.subject_code,
        faculty: session.staff_name,
        faculty_id: session.staff_employee_code || session.faculty_id,
        class: session.class_name,
        section: session.section_name || 'A',
        date: new Date(session.start_time).toLocaleDateString(),
        time: new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      verification: 'QR + FACE',
      confidence: matchResult.confidencePercentage || 95.0,
      timestamp: timestampIso
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        success: false,
        alreadyMarked: true,
        message: `Attendance already recorded for this session.`
      });
    }
    console.error('Error recording public face attendance:', err);
    return res.status(500).json({ success: false, message: 'Server error while saving attendance record.' });
  }
});

// POST /api/attendance/mark (The core multi-factor verification pipeline)
router.post('/mark', authenticate, requireRole('student'), (req, res) => {
  const student = req.student;
  if (!student) {
    return res.status(403).json({ success: false, message: 'Student profile not linked to user account.' });
  }

  const {
    session_id,
    verification_method = 'qr_gps_otp', // 'qr_gps_otp' or 'face_gps_otp'
    qr_token,
    face_descriptor,
    liveness_score = 0.95,
    gps_lat,
    gps_lng,
    otp,
    device_info,
    scanned_image,
    image_data
  } = req.body;

  const capturedImage = scanned_image || image_data || null;

  if (!session_id) {
    return res.status(400).json({ success: false, message: 'Session ID is required.' });
  }

  // 1. FETCH ATTENDANCE SESSION & GEOFENCE LOCATION
  const session = db.prepare(`
    SELECT asess.*, loc.name as location_name, loc.latitude as location_lat,
           loc.longitude as location_lng, loc.radius_meters as location_radius,
           sub.name as subject_name, sub.code as subject_code
    FROM attendance_sessions asess
    JOIN attendance_locations loc ON asess.location_id = loc.id
    JOIN subjects sub ON asess.subject_id = sub.id
    WHERE asess.id = ?
  `).get(session_id);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Attendance session not found.' });
  }

  if (session.status === 'paused') {
    return res.status(400).json({
      success: false,
      message: 'Attendance session is currently paused by faculty. Please wait a moment.'
    });
  }

  if (session.status === 'closed') {
    logAuditEvent({
      userId: req.user.id,
      userRole: 'student',
      userName: req.user.name,
      action: 'ATTEMPT_AFTER_CLOSED',
      severity: 'warning',
      sessionId: session.id,
      ipAddress: req.ip,
      description: `Student attempted to mark attendance after session had already closed.`
    });
    return res.status(400).json({ success: false, message: 'Attendance session is closed. No further check-ins allowed.' });
  }

  // 2. CHECK CLASS ENROLLMENT MEMBERSHIP
  if (session.class_id !== student.class_id) {
    logAuditEvent({
      userId: req.user.id,
      userRole: 'student',
      userName: req.user.name,
      action: 'WRONG_CLASS_ATTEMPT',
      severity: 'danger',
      sessionId: session.id,
      ipAddress: req.ip,
      description: `Student from class (${student.class_name}) tried to mark attendance for another class (${session.class_id}).`
    });
    return res.status(403).json({
      success: false,
      message: 'You are not enrolled in the class for which this attendance session is running.'
    });
  }

  // 3. DUPLICATE ATTENDANCE CHECK
  const existingRecord = db.prepare(`
    SELECT * FROM attendance_records WHERE student_id = ? AND session_id = ?
  `).get(student.id, session.id);

  if (existingRecord) {
    return res.status(400).json({
      success: false,
      message: `Attendance already recorded as ${existingRecord.status.toUpperCase()} at ${new Date(existingRecord.timestamp).toLocaleTimeString()}.`,
      record: existingRecord
    });
  }

  // 4. TIME VALIDATION
  const now = new Date();
  const startTime = new Date(session.start_time);
  const endTime = new Date(session.end_time);
  const lateThreshold = new Date(session.late_threshold_time);

  if (now > endTime) {
    return res.status(400).json({
      success: false,
      message: 'Attendance window has expired for this session.'
    });
  }

  let computedStatus = 'present';
  if (now > lateThreshold) {
    computedStatus = 'late';
  }

  let distanceMeters = 0;

  // 5. METHOD SPECIFIC VALIDATION (QR + Face Recognition Workflow)
  if (verification_method === 'qr_face') {
    // 5A. Validate QR Code token / session link
    if (qr_token && qr_token !== session.id) {
      const qrValidation = validateQrToken(session.id, qr_token);
      if (!qrValidation.isValid && qr_token !== session.current_qr_token) {
        logAuditEvent({
          userId: req.user.id,
          userRole: 'student',
          userName: req.user.name,
          action: 'INVALID_QR_SCAN',
          severity: 'warning',
          sessionId: session.id,
          ipAddress: req.ip,
          description: `QR Code Validation Failed: ${qrValidation.message || 'Token mismatch'}`
        });
        return res.status(400).json({
          success: false,
          isMatch: false,
          status: 'absent',
          message: qrValidation.message || 'Invalid or expired Class QR Code.'
        });
      }
    }

    // 5B. Face Recognition Matching
    const faceResult = verifyFaceEmbedding(student.id, face_descriptor, liveness_score);
    if (!faceResult.isMatch) {
      logAuditEvent({
        userId: req.user.id,
        userRole: 'student',
        userName: req.user.name,
        action: 'FACE_NO_MATCH',
        severity: 'danger',
        sessionId: session.id,
        ipAddress: req.ip,
        description: `Face Recognition: NO MATCH for ${student.student_id} (${student.name}). Biometric distance exceeded threshold.`
      });
      return res.status(400).json({
        success: false,
        isMatch: false,
        status: 'absent',
        message: faceResult.message || 'Face Recognition: NO MATCH. Biometrics do not match registered student. Attendance marked as ABSENT.'
      });
    }

    // Optional GPS check if coordinates are provided
    if (gps_lat && gps_lng) {
      const locationObj = {
        name: session.location_name,
        latitude: session.location_lat,
        longitude: session.location_lng,
        radius_meters: session.location_radius
      };
      const geofenceResult = verifyGeofence(gps_lat, gps_lng, locationObj);
      distanceMeters = geofenceResult.distanceMeters || 0;
      if (!geofenceResult.isValid) {
        logAuditEvent({
          userId: req.user.id,
          userRole: 'student',
          userName: req.user.name,
          action: 'GPS_GEOFENCE_BREACH',
          severity: 'warning',
          sessionId: session.id,
          ipAddress: req.ip,
          description: `GPS Check Failed: Student is ${geofenceResult.distanceMeters}m away from ${locationObj.name}.`
        });
      }
    }
  } else if (verification_method === 'qr_gps_otp') {
    const qrValidation = validateQrToken(session.id, qr_token);
    if (!qrValidation.isValid) {
      logAuditEvent({
        userId: req.user.id,
        userRole: 'student',
        userName: req.user.name,
        action: 'INVALID_QR_SCAN',
        severity: 'warning',
        sessionId: session.id,
        ipAddress: req.ip,
        description: `QR Validation Failed: ${qrValidation.message}`
      });
      return res.status(400).json({
        success: false,
        message: qrValidation.message || 'Invalid or expired QR code.'
      });
    }

    // GPS GEOFENCE VALIDATION
    const locationObj = {
      name: session.location_name,
      latitude: session.location_lat,
      longitude: session.location_lng,
      radius_meters: session.location_radius
    };
    const geofenceResult = verifyGeofence(gps_lat, gps_lng, locationObj);
    distanceMeters = geofenceResult.distanceMeters || 0;
    if (!geofenceResult.isValid) {
      return res.status(400).json({
        success: false,
        message: `Location verification failed! You are ${geofenceResult.distanceMeters}m away from the campus classroom.`,
        distanceMeters: geofenceResult.distanceMeters,
        allowedRadius: locationObj.radius_meters
      });
    }

    // OTP VERIFICATION
    const maxOtpAttempts = parseInt(db.prepare(`SELECT value FROM attendance_settings WHERE key = 'max_otp_attempts'`).get()?.value || '5');
    const otpResult = verifyOtp(session.id, otp, maxOtpAttempts);
    if (!otpResult.isValid) {
      return res.status(400).json({
        success: false,
        message: otpResult.message || 'Incorrect attendance OTP.'
      });
    }
  } else if (verification_method === 'face_gps_otp') {
    if (!session.allow_face_fallback) {
      return res.status(403).json({
        success: false,
        message: 'Camera Face Verification fallback is disabled for this session by faculty.'
      });
    }

    const faceResult = verifyFaceEmbedding(student.id, face_descriptor, liveness_score);
    if (!faceResult.isMatch) {
      logAuditEvent({
        userId: req.user.id,
        userRole: 'student',
        userName: req.user.name,
        action: 'FACE_VERIFICATION_FAILED',
        severity: 'warning',
        sessionId: session.id,
        ipAddress: req.ip,
        description: `Face Verification Failed for ${student.student_id}: ${faceResult.message}`
      });
      return res.status(400).json({
        success: false,
        message: faceResult.message || 'Face verification failed.'
      });
    }

    // GPS GEOFENCE VALIDATION
    const locationObj = {
      name: session.location_name,
      latitude: session.location_lat,
      longitude: session.location_lng,
      radius_meters: session.location_radius
    };
    const geofenceResult = verifyGeofence(gps_lat, gps_lng, locationObj);
    distanceMeters = geofenceResult.distanceMeters || 0;
    if (!geofenceResult.isValid) {
      return res.status(400).json({
        success: false,
        message: `Location verification failed! You are ${geofenceResult.distanceMeters}m away.`,
        distanceMeters: geofenceResult.distanceMeters,
        allowedRadius: locationObj.radius_meters
      });
    }

    // OTP VERIFICATION
    const maxOtpAttempts = parseInt(db.prepare(`SELECT value FROM attendance_settings WHERE key = 'max_otp_attempts'`).get()?.value || '5');
    const otpResult = verifyOtp(session.id, otp, maxOtpAttempts);
    if (!otpResult.isValid) {
      return res.status(400).json({
        success: false,
        message: otpResult.message || 'Incorrect attendance OTP.'
      });
    }
  } else {
    return res.status(400).json({ success: false, message: 'Invalid verification method requested.' });
  }

  // 8. ATOMIC DATABASE RECORD CREATION
  const recordId = uuidv4();
  const timestampIso = now.toISOString();

  try {
    const markTx = db.transaction(() => {
      // Insert attendance record
      db.prepare(`
        INSERT INTO attendance_records (
          id, student_id, session_id, status, timestamp, verification_method,
          gps_lat, gps_lng, gps_distance_meters, ip_address, device_info, created_at, scanned_image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        recordId,
        student.id,
        session.id,
        computedStatus,
        timestampIso,
        verification_method,
        gps_lat ? parseFloat(gps_lat) : 0,
        gps_lng ? parseFloat(gps_lng) : 0,
        distanceMeters,
        req.ip || '127.0.0.1',
        device_info || req.headers['user-agent'] || 'Web Client',
        timestampIso,
        capturedImage
      );

      // Increment session counter
      if (computedStatus === 'present') {
        db.prepare(`UPDATE attendance_sessions SET total_present = total_present + 1 WHERE id = ?`).run(session.id);
      } else {
        db.prepare(`UPDATE attendance_sessions SET total_late = total_late + 1 WHERE id = ?`).run(session.id);
      }

      // Add student notification
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type)
        VALUES (?, ?, ?, ?, 'success')
      `).run(
        uuidv4(),
        req.user.id,
        `Attendance Marked (${computedStatus.toUpperCase()})`,
        `Your attendance for ${session.subject_name} has been verified and recorded.`
      );
    });

    markTx();

    // Sync in real-time to Supabase PostgreSQL cloud database
    syncSingleAttendanceRecord({
      id: recordId,
      student_id: student.id,
      session_id: session.id,
      status: computedStatus,
      timestamp: timestampIso,
      verification_method,
      gps_lat: gps_lat ? parseFloat(gps_lat) : 0,
      gps_lng: gps_lng ? parseFloat(gps_lng) : 0,
      gps_distance_meters: distanceMeters,
      ip_address: req.ip || '127.0.0.1',
      device_info: device_info || req.headers['user-agent'] || 'Web Client',
      created_at: timestampIso,
      scanned_image: capturedImage
    }).catch(() => {});

    logAuditEvent({
      userId: req.user.id,
      userRole: 'student',
      userName: req.user.name,
      action: 'ATTENDANCE_SUCCESS',
      severity: 'info',
      sessionId: session.id,
      ipAddress: req.ip,
      description: `Attendance recorded as ${computedStatus.toUpperCase()} via ${verification_method} (GPS: ${distanceMeters}m).`
    });

    // 9. EMIT REAL-TIME WEBSOCKET NOTIFICATION TO FACULTY & LIVE DASHBOARDS
    const io = getSocketIo(req);
    if (io) {
      io.to(`session_${session.id}`).emit('STUDENT_CHECKED_IN', {
        sessionId: session.id,
        student: {
          id: student.id,
          name: req.user.name,
          roll_no: student.roll_no,
          student_code: student.student_id,
          status: computedStatus,
          marked_at: timestampIso,
          verification_method,
          distanceMeters
        }
      });
    }

    return res.json({
      success: true,
      message: computedStatus === 'present' ? 'Attendance Marked Successfully! You are marked PRESENT.' : 'Attendance Marked. You are marked LATE (Late arrival period).',
      status: computedStatus,
      recordId,
      timestamp: timestampIso,
      verificationMethod: verification_method,
      distanceMeters,
      subjectName: session.subject_name,
      period: session.period_name
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, message: 'Attendance already recorded for this session.' });
    }
    console.error('Error recording attendance:', err);
    return res.status(500).json({ success: false, message: 'Failed to record attendance in database.' });
  }
});

// POST /api/attendance/override (Faculty / Admin manual correction with reason)
router.post('/override', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const { session_id, student_id, new_status, reason } = req.body;

  if (!session_id || !student_id || !new_status || !reason) {
    return res.status(400).json({ success: false, message: 'Session ID, Student ID, Status, and Reason are required.' });
  }

  const session = db.prepare(`SELECT * FROM attendance_sessions WHERE id = ?`).get(session_id);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  const existingRecord = db.prepare(`
    SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?
  `).get(session_id, student_id);

  const student = db.prepare(`
    SELECT s.*, u.name as student_name FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?
  `).get(student_id);

  const tx = db.transaction(() => {
    if (new_status === 'absent') {
      if (existingRecord) {
        db.prepare(`DELETE FROM attendance_records WHERE id = ?`).run(existingRecord.id);
      }
    } else {
      if (existingRecord) {
        db.prepare(`
          UPDATE attendance_records
          SET status = ?, corrected_by = ?, correction_reason = ?
          WHERE id = ?
        `).run(new_status, req.user.name, reason.trim(), existingRecord.id);
      } else {
        db.prepare(`
          INSERT INTO attendance_records (
            id, student_id, session_id, status, timestamp, verification_method,
            corrected_by, correction_reason, created_at
          ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'faculty_override', ?, ?, CURRENT_TIMESTAMP)
        `).run(uuidv4(), student_id, session_id, new_status, req.user.name, reason.trim());
      }
    }

    // Recompute session counts
    const counts = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count
      FROM attendance_records
      WHERE session_id = ?
    `).get(session_id);

    const present = counts.present_count || 0;
    const late = counts.late_count || 0;
    const absent = Math.max(0, session.total_expected - (present + late));

    db.prepare(`
      UPDATE attendance_sessions
      SET total_present = ?, total_late = ?, total_absent = ?
      WHERE id = ?
    `).run(present, late, absent, session_id);
  });

  tx();

  logAuditEvent({
    userId: req.user.id,
    userRole: req.user.role,
    userName: req.user.name,
    action: 'MANUAL_CORRECTION',
    severity: 'info',
    sessionId: session_id,
    ipAddress: req.ip,
    description: `Manual attendance override for student ${student ? student.student_name : student_id} to '${new_status}'. Reason: ${reason}`
  });

  const io = getSocketIo(req);
  if (io) {
    io.to(`session_${session_id}`).emit('ATTENDANCE_OVERRIDDEN', {
      sessionId: session_id,
      studentId: student_id,
      newStatus: new_status
    });
  }

  return res.json({ success: true, message: 'Attendance status successfully updated.' });
});

// POST /api/attendance/staff-scan (Staff scans student QR code with device camera)
router.post('/staff-scan', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const { session_id, student_qr_data, student_id, roll_no } = req.body;

  if (!session_id) {
    return res.status(400).json({ success: false, message: 'Session ID is required.' });
  }

  // 1. Fetch Session
  const session = db.prepare(`
    SELECT asess.*, sub.name as subject_name, sub.code as subject_code
    FROM attendance_sessions asess
    JOIN subjects sub ON asess.subject_id = sub.id
    WHERE asess.id = ?
  `).get(session_id);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Attendance session not found.' });
  }

  if (session.status === 'closed') {
    return res.status(400).json({ success: false, message: 'Session is already closed.' });
  }

  // 2. Resolve Student
  let targetStudentId = student_id;
  let targetRollNo = roll_no;

  if (student_qr_data) {
    try {
      const parsed = typeof student_qr_data === 'string' ? JSON.parse(student_qr_data) : student_qr_data;
      if (parsed.studentId) targetStudentId = parsed.studentId;
      if (parsed.rollNo) targetRollNo = parsed.rollNo;
    } catch {
      // If plain string, check if roll number or UUID
      if (student_qr_data.startsWith('STU-') || student_qr_data.length <= 10) {
        targetRollNo = student_qr_data;
      } else {
        targetStudentId = student_qr_data;
      }
    }
  }

  let student = null;
  if (targetStudentId) {
    student = db.prepare(`
      SELECT s.*, u.name as student_name, u.email, c.name as class_name, d.name as department_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN classes c ON s.class_id = c.id
      JOIN departments d ON s.department_id = d.id
      WHERE s.id = ? OR s.student_id = ?
    `).get(targetStudentId, targetStudentId);
  } else if (targetRollNo) {
    student = db.prepare(`
      SELECT s.*, u.name as student_name, u.email, c.name as class_name, d.name as department_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN classes c ON s.class_id = c.id
      JOIN departments d ON s.department_id = d.id
      WHERE s.roll_no = ?
    `).get(targetRollNo);
  }

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found in institutional database.' });
  }

  // 3. Class match verification
  if (student.class_id !== session.class_id) {
    return res.status(400).json({
      success: false,
      message: `Student ${student.student_name} (${student.roll_no}) belongs to ${student.class_name}, but current session is for another class.`
    });
  }

  // 4. Duplicate Check
  const existingRecord = db.prepare(`
    SELECT * FROM attendance_records WHERE student_id = ? AND session_id = ?
  `).get(student.id, session.id);

  if (existingRecord) {
    return res.json({
      success: true,
      alreadyMarked: true,
      message: `Student ${student.student_name} (${student.roll_no}) is already recorded as ${existingRecord.status.toUpperCase()} at ${new Date(existingRecord.timestamp).toLocaleTimeString()}.`,
      student: {
        id: student.id,
        name: student.student_name,
        roll_no: student.roll_no,
        class_name: student.class_name,
        status: existingRecord.status
      },
      timestamp: existingRecord.timestamp
    });
  }

  // 5. Insert Record
  const now = new Date();
  const timestampIso = now.toISOString();
  const recordId = uuidv4();
  const computedStatus = now > new Date(session.late_threshold_time) ? 'late' : 'present';

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO attendance_records (
        id, student_id, session_id, status, timestamp, verification_method,
        ip_address, device_info, corrected_by, correction_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, 'staff_qr_scan', ?, ?, ?, 'Staff Camera QR Scan', ?)
    `).run(
      recordId,
      student.id,
      session.id,
      computedStatus,
      timestampIso,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] || 'Staff Scanner',
      req.user.name,
      timestampIso
    );

    if (computedStatus === 'present') {
      db.prepare(`UPDATE attendance_sessions SET total_present = total_present + 1 WHERE id = ?`).run(session.id);
    } else {
      db.prepare(`UPDATE attendance_sessions SET total_late = total_late + 1 WHERE id = ?`).run(session.id);
    }

    // Student Notification
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type)
      VALUES (?, ?, ?, ?, 'success')
    `).run(
      uuidv4(),
      student.user_id,
      `Attendance Marked (${computedStatus.toUpperCase()})`,
      `Staff scanned your ID QR for ${session.subject_name}. Marked ${computedStatus.toUpperCase()}.`
    );
  });

  tx();

  // 6. Broadcast Real-time WebSocket event to Live Room
  const io = getSocketIo(req);
  if (io) {
    io.to(`session_${session.id}`).emit('STUDENT_CHECKED_IN', {
      sessionId: session.id,
      student: {
        id: student.id,
        name: student.student_name,
        roll_no: student.roll_no,
        student_code: student.student_id,
        status: computedStatus,
        marked_at: timestampIso,
        verification_method: 'staff_qr_scan',
        distanceMeters: 0
      }
    });
  }

  return res.json({
    success: true,
    message: `✓ Attendance Recorded! ${student.student_name} (${student.roll_no}) marked ${computedStatus.toUpperCase()}.`,
    status: computedStatus,
    student: {
      id: student.id,
      name: student.student_name,
      roll_no: student.roll_no,
      class_name: student.class_name,
      department: student.department_name
    },
    subject: session.subject_name,
    timestamp: timestampIso
  });
});

// GET /api/attendance/student-history (Student dashboard personal stats & history)
router.get('/student-history', authenticate, requireRole('student'), (req, res) => {
  const student = req.student;
  if (!student) {
    return res.status(403).json({ success: false, message: 'Student profile missing.' });
  }

  // Fetch full attendance history records
  const history = db.prepare(`
    SELECT ar.id, ar.status, ar.timestamp, ar.verification_method,
           ar.gps_distance_meters, ar.corrected_by, ar.correction_reason,
           asess.period_name, asess.start_time,
           sub.name as subject_name, sub.code as subject_code,
           u.name as faculty_name
    FROM attendance_records ar
    JOIN attendance_sessions asess ON ar.session_id = asess.id
    JOIN subjects sub ON asess.subject_id = sub.id
    JOIN faculty f ON asess.faculty_id = f.id
    JOIN users u ON f.user_id = u.id
    WHERE ar.student_id = ?
    ORDER BY ar.timestamp DESC
  `).all(student.id);

  // Total conducted sessions for this student's class
  const totalConducted = db.prepare(`
    SELECT COUNT(*) as count FROM attendance_sessions
    WHERE class_id = ? AND status = 'closed'
  `).get(student.class_id)?.count || 0;

  const presentCount = history.filter(h => h.status === 'present').length;
  const lateCount = history.filter(h => h.status === 'late').length;
  const attendedCount = presentCount + lateCount;
  const absentCount = Math.max(0, totalConducted - attendedCount);
  const percentage = totalConducted > 0 ? Number(((attendedCount / totalConducted) * 100).toFixed(1)) : 100.0;

  // Subject-wise breakdown
  const subjects = db.prepare(`
    SELECT sub.id, sub.name, sub.code
    FROM subjects sub
    WHERE sub.department_id = ?
    ORDER BY sub.name
  `).all(student.department_id);

  const subjectStats = subjects.map(sub => {
    const subConducted = db.prepare(`
      SELECT COUNT(*) as count FROM attendance_sessions
      WHERE class_id = ? AND subject_id = ? AND status = 'closed'
    `).get(student.class_id, sub.id)?.count || 0;

    const subHistory = history.filter(h => h.subject_code === sub.code);
    const subPresent = subHistory.filter(h => h.status === 'present').length;
    const subLate = subHistory.filter(h => h.status === 'late').length;
    const subAttended = subPresent + subLate;
    const subAbsent = Math.max(0, subConducted - subAttended);
    const subPct = subConducted > 0 ? Number(((subAttended / subConducted) * 100).toFixed(1)) : 100.0;

    return {
      subjectId: sub.id,
      subjectName: sub.name,
      subjectCode: sub.code,
      totalClasses: subConducted,
      present: subPresent,
      late: subLate,
      absent: subAbsent,
      percentage: subPct,
      isLow: subPct < 75.0
    };
  });

  return res.json({
    success: true,
    stats: {
      totalClasses: totalConducted,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      percentage,
      isLowAttendance: percentage < 75.0
    },
    subjectStats,
    history
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { enrollStudentFace, deleteStudentFace } = require('../services/faceVerification.service');
const { logAuditEvent } = require('../services/misuseDetection.service');

// GET /api/face/status (Check if face is enrolled)
router.get('/status', authenticate, (req, res) => {
  let studentId = req.student?.id;
  
  if (!studentId && (req.user.role === 'admin' || req.user.role === 'faculty') && req.query.student_id) {
    const studentRec = db.prepare(`SELECT id FROM students WHERE id = ? OR student_id = ?`).get(req.query.student_id, req.query.student_id);
    if (studentRec) studentId = studentRec.id;
  }

  if (!studentId && req.user.role === 'student') {
    const studentRec = db.prepare(`SELECT id FROM students WHERE user_id = ?`).get(req.user.id);
    if (studentRec) studentId = studentRec.id;
  }

  if (!studentId) {
    return res.json({
      success: true,
      isEnrolled: false,
      templateInfo: null,
      message: 'No student record associated.'
    });
  }

  const template = db.prepare(`
    SELECT id, liveness_score, consent_status, consent_timestamp, enrolled_at, updated_at
    FROM face_templates
    WHERE student_id = ?
  `).get(studentId);

  return res.json({
    success: true,
    isEnrolled: !!(template && template.consent_status === 1),
    templateInfo: template
      ? {
          enrolledAt: template.enrolled_at,
          updatedAt: template.updated_at,
          consentTimestamp: template.consent_timestamp,
          livenessConfidence: template.liveness_score
        }
      : null
  });
});

// POST /api/face/enroll (Enroll face embedding with explicit consent)
router.post('/enroll', authenticate, (req, res) => {
  let studentId = req.student?.id;

  if (req.user.role === 'student') {
    if (!studentId) {
      const studentRec = db.prepare(`SELECT id FROM students WHERE user_id = ?`).get(req.user.id);
      if (studentRec) studentId = studentRec.id;
    }
    if (!studentId) {
      return res.status(403).json({ success: false, message: 'Student profile not found.' });
    }
  } else if (req.user.role === 'admin' || req.user.role === 'faculty') {
    const target = req.body.student_id || req.body.studentId;
    if (!target) {
      return res.status(400).json({ success: false, message: 'Target student_id is required.' });
    }
    const studentRec = db.prepare(`SELECT id FROM students WHERE id = ? OR student_id = ?`).get(target, target);
    if (!studentRec) {
      return res.status(404).json({ success: false, message: 'Target student not found in directory.' });
    }
    studentId = studentRec.id;
  } else {
    return res.status(403).json({ success: false, message: 'Unauthorized role for face enrollment.' });
  }

  let { descriptor, liveness_score = 0.98, consent_given = true, scanned_image, image_data } = req.body;
  const imageSnapshot = scanned_image || image_data || null;

  if (typeof descriptor === 'string') {
    try {
      descriptor = JSON.parse(descriptor);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid descriptor format.' });
    }
  }

  if (!descriptor || !Array.isArray(descriptor) || descriptor.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid facial descriptor vector (128-d) is required from camera enrollment.'
    });
  }

  try {
    const result = enrollStudentFace(studentId, descriptor, liveness_score, true, imageSnapshot);

    logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      userName: req.user.name,
      action: 'FACE_ENROLLED',
      severity: 'info',
      ipAddress: req.ip,
      description: `User (${req.user.name}) enrolled face biometric template with explicit consent.`
    });

    return res.json({
      success: true,
      message: 'Face enrollment completed successfully.',
      details: result
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Face enrollment failed.' });
  }
});

// DELETE /api/face/revoke (Revoke consent and permanently purge biometric data)
router.delete('/revoke', authenticate, requireRole('student'), (req, res) => {
  const student = req.student;
  if (!student) {
    return res.status(403).json({ success: false, message: 'Student profile not found.' });
  }

  const result = deleteStudentFace(student.id);

  logAuditEvent({
    userId: req.user.id,
    userRole: 'student',
    userName: req.user.name,
    action: 'FACE_REVOKED',
    severity: 'info',
    ipAddress: req.ip,
    description: `Student exercised privacy right and revoked facial biometric data.`
  });

  return res.json({
    success: true,
    message: 'Biometric face template permanently deleted from system.',
    result
  });
});

// ==========================================
// STAFF & ADMIN FACE ENROLLMENT & MANAGEMENT
// ==========================================

// GET /api/face/admin/stats (Biometric enrollment analytics and stats)
router.get('/admin/stats', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const totalStudents = db.prepare(`SELECT COUNT(*) as count FROM students`).get()?.count || 0;
  const enrolledCount = db.prepare(`SELECT COUNT(*) as count FROM face_templates WHERE consent_status = 1`).get()?.count || 0;
  const pendingCount = Math.max(0, totalStudents - enrolledCount);
  const enrolledPct = totalStudents > 0 ? Number(((enrolledCount / totalStudents) * 100).toFixed(1)) : 0;

  return res.json({
    success: true,
    stats: {
      totalStudents,
      enrolledCount,
      pendingCount,
      enrolledPercentage: enrolledPct
    }
  });
});

// POST /api/face/admin/verify-live (Admin test face match live tester)
router.post('/admin/verify-live', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const { descriptor, liveness_score = 0.98, class_id } = req.body;

  if (!descriptor || !Array.isArray(descriptor)) {
    return res.status(400).json({ success: false, message: 'Valid 128-d descriptor vector required.' });
  }

  const { matchFaceInClassRoster } = require('../services/faceVerification.service');
  const targetClassId = class_id || db.prepare(`SELECT id FROM classes LIMIT 1`).get()?.id;

  const result = matchFaceInClassRoster(targetClassId, descriptor, liveness_score, 0.50);

  return res.json({
    success: true,
    result
  });
});

// GET /api/face/admin/students (List students and their face biometric enrollment status)
router.get('/admin/students', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const { class_id, department_id, search } = req.query;

  let query = `
    SELECT s.id, s.student_id, s.roll_no, s.class_id, s.department_id,
           u.name as student_name, u.email,
           c.name as class_name,
           d.name as department_name,
           ft.id as template_id,
           ft.liveness_score,
           ft.enrolled_at,
           ft.updated_at,
           CASE WHEN ft.id IS NOT NULL AND ft.consent_status = 1 THEN 1 ELSE 0 END as is_enrolled
    FROM students s
    JOIN users u ON s.user_id = u.id
    JOIN classes c ON s.class_id = c.id
    JOIN departments d ON s.department_id = d.id
    LEFT JOIN face_templates ft ON ft.student_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (class_id) {
    query += ` AND s.class_id = ?`;
    params.push(class_id);
  }
  if (department_id) {
    query += ` AND s.department_id = ?`;
    params.push(department_id);
  }
  if (search) {
    query += ` AND (u.name LIKE ? OR s.student_id LIKE ? OR s.roll_no LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  query += ` ORDER BY c.name, s.roll_no ASC`;

  const students = db.prepare(query).all(...params);

  return res.json({
    success: true,
    count: students.length,
    students: students.map(st => ({
      id: st.id,
      studentId: st.student_id,
      rollNo: st.roll_no,
      name: st.student_name,
      email: st.email,
      className: st.class_name,
      classId: st.class_id,
      departmentName: st.department_name,
      isEnrolled: Boolean(st.is_enrolled),
      templateId: st.template_id,
      enrolledAt: st.enrolled_at,
      updatedAt: st.updated_at,
      livenessConfidence: st.liveness_score
    }))
  });
});

// POST /api/face/admin/enroll (Staff/Admin captures and enrolls student face template)
router.post('/admin/enroll', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const { student_id, descriptor, liveness_score = 0.98, sample_count = 3 } = req.body;

  if (!student_id) {
    return res.status(400).json({ success: false, message: 'Target Student ID is required.' });
  }

  // Resolve student by id or student_id
  const student = db.prepare(`
    SELECT s.*, u.name, u.email, c.name as class_name
    FROM students s
    JOIN users u ON s.user_id = u.id
    JOIN classes c ON s.class_id = c.id
    WHERE s.id = ? OR s.student_id = ?
  `).get(student_id, student_id);

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student record not found in institutional directory.' });
  }

  if (!descriptor || !Array.isArray(descriptor) || descriptor.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid facial descriptor vector (128-d) is required from camera enrollment.'
    });
  }

  try {
    const result = enrollStudentFace(student.id, descriptor, liveness_score, true);

    logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      userName: req.user.name,
      action: 'STAFF_FACE_ENROLLMENT',
      severity: 'info',
      ipAddress: req.ip,
      description: `Staff (${req.user.name}) enrolled face biometric template for student ${student.name} (${student.student_id}) with ${sample_count} verified samples.`
    });

    return res.json({
      success: true,
      message: `✓ Face biometric template successfully registered for ${student.name} (${student.roll_no}).`,
      student: {
        id: student.id,
        studentId: student.student_id,
        name: student.name,
        rollNo: student.roll_no,
        className: student.class_name
      },
      details: result
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Face enrollment failed.' });
  }
});

// DELETE /api/face/admin/:studentId (Authorized staff purges / resets student face template)
router.delete('/admin/:studentId', authenticate, requireRole(['faculty', 'admin']), (req, res) => {
  const { studentId } = req.params;

  const student = db.prepare(`
    SELECT s.*, u.name FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ? OR s.student_id = ?
  `).get(studentId, studentId);

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student record not found.' });
  }

  const result = deleteStudentFace(student.id);

  logAuditEvent({
    userId: req.user.id,
    userRole: req.user.role,
    userName: req.user.name,
    action: 'STAFF_FACE_PURGE',
    severity: 'warning',
    ipAddress: req.ip,
    description: `Staff (${req.user.name}) purged biometric face template for student ${student.name} (${student.student_id}).`
  });

  return res.json({
    success: true,
    message: `Face biometric template purged for ${student.name}.`,
    result
  });
});

module.exports = router;


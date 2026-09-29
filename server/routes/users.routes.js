const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/users/students (Admin & Faculty)
router.get('/students', authenticate, requireRole(['admin', 'faculty']), (req, res) => {
  const { class_id, department_id } = req.query;

  let query = `
    SELECT s.*, u.name, u.email, u.status, u.avatar,
           c.name as class_name, d.name as department_name, d.code as department_code,
           y.label as year_label, sec.name as section_name,
           (SELECT COUNT(*) FROM face_templates ft WHERE ft.student_id = s.id AND ft.consent_status = 1) as has_face_enrolled,
           (SELECT COUNT(*) FROM attendance_records ar WHERE ar.student_id = s.id AND ar.status IN ('present', 'late')) as total_attended,
           (SELECT COUNT(*) FROM attendance_sessions asess WHERE asess.class_id = s.class_id AND asess.status = 'closed') as total_conducted
    FROM students s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN departments d ON s.department_id = d.id
    LEFT JOIN academic_years y ON s.year_id = y.id
    LEFT JOIN sections sec ON s.section_id = sec.id
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

  query += ` ORDER BY s.roll_no ASC`;

  const students = db.prepare(query).all(...params);

  // Compute calculated percentage
  const formatted = students.map(st => {
    const conducted = st.total_conducted || 0;
    const attended = st.total_attended || 0;
    const pct = conducted > 0 ? Number(((attended / conducted) * 100).toFixed(1)) : 100.0;
    return {
      ...st,
      attendance_percentage: pct,
      is_low_attendance: pct < 75.0
    };
  });

  return res.json({ success: true, count: formatted.length, data: formatted });
});

// GET /api/users/faculty (Admin)
router.get('/faculty', authenticate, requireRole('admin'), (req, res) => {
  const facultyList = db.prepare(`
    SELECT f.*, u.name, u.email, u.status, u.avatar,
           d.name as department_name, d.code as department_code
    FROM faculty f
    JOIN users u ON f.user_id = u.id
    LEFT JOIN departments d ON f.department_id = d.id
    ORDER BY u.name ASC
  `).all();

  const getAssignments = db.prepare(`
    SELECT fa.*, sub.name as subject_name, sub.code as subject_code, c.name as class_name
    FROM faculty_assignments fa
    JOIN subjects sub ON fa.subject_id = sub.id
    JOIN classes c ON fa.class_id = c.id
    WHERE fa.faculty_id = ?
  `);

  const enriched = facultyList.map(f => ({
    ...f,
    assignments: getAssignments.all(f.id)
  }));

  return res.json({ success: true, count: enriched.length, data: enriched });
});

// POST /api/users/student (Admin creates student)
router.post('/student', authenticate, requireRole('admin'), (req, res) => {
  const { name, email, password, student_id, roll_no, department_id, year_id, class_id, section_id, phone } = req.body;

  if (!name || !email || !password || !roll_no || !class_id) {
    return res.status(400).json({ success: false, message: 'Name, email, password, roll no, and class are required.' });
  }

  // Resolve department and year from class if not provided
  let finalDeptId = department_id;
  let finalYearId = year_id;
  const classObj = db.prepare(`SELECT * FROM classes WHERE id = ?`).get(class_id);
  if (classObj) {
    if (!finalDeptId) finalDeptId = classObj.department_id;
    if (!finalYearId) finalYearId = classObj.year_id;
  }

  if (!finalDeptId) {
    const firstDept = db.prepare(`SELECT id FROM departments LIMIT 1`).get();
    finalDeptId = firstDept ? firstDept.id : null;
  }
  if (!finalYearId) {
    const firstYear = db.prepare(`SELECT id FROM academic_years LIMIT 1`).get();
    finalYearId = firstYear ? firstYear.id : null;
  }

  const finalStudentId = student_id ? student_id.trim() : `STU-${Date.now().toString().substring(7)}`;

  const existing = db.prepare(`SELECT id FROM users WHERE email = ? COLLATE NOCASE`).get(email.trim());
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email address already exists.' });
  }

  const userId = uuidv4();
  const sId = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, 'student', 'active')
    `).run(userId, name.trim(), email.trim(), passwordHash);

    db.prepare(`
      INSERT INTO students (id, user_id, student_id, roll_no, department_id, year_id, class_id, section_id, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sId, userId, finalStudentId, roll_no.trim(), finalDeptId, finalYearId, class_id, section_id || null, phone || null);
  });

  tx();

  return res.json({ success: true, message: 'Student account created successfully.', studentId: sId });
});

// POST /api/users/faculty (Admin creates faculty)
router.post('/faculty', authenticate, requireRole('admin'), (req, res) => {
  const { name, email, password, faculty_id, department_id, designation, phone } = req.body;

  if (!name || !email || !password || !faculty_id || !department_id) {
    return res.status(400).json({ success: false, message: 'All required faculty fields must be filled.' });
  }

  const existing = db.prepare(`SELECT id FROM users WHERE email = ? COLLATE NOCASE`).get(email.trim());
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email address already in use.' });
  }

  const userId = uuidv4();
  const facId = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES (?, ?, ?, ?, 'faculty', 'active')
    `).run(userId, name.trim(), email.trim(), passwordHash);

    db.prepare(`
      INSERT INTO faculty (id, user_id, faculty_id, department_id, designation, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(facId, userId, faculty_id.trim(), department_id, designation || 'Assistant Professor', phone || null);
  });

  tx();

  return res.json({ success: true, message: 'Faculty account created successfully.', facultyId: facId });
});

// DELETE /api/users/:id
router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const user = db.prepare(`SELECT role FROM users WHERE id = ?`).get(id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (user.role === 'admin') {
    return res.status(400).json({ success: false, message: 'Cannot delete admin account.' });
  }

  db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  return res.json({ success: true, message: 'User deleted successfully.' });
});

module.exports = router;

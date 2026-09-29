const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/academic/structure (Returns full hierarchy)
router.get('/structure', authenticate, (req, res) => {
  const departments = db.prepare(`SELECT * FROM departments ORDER BY name`).all();
  const academicYears = db.prepare(`SELECT * FROM academic_years ORDER BY year_number`).all();
  const classes = db.prepare(`
    SELECT c.*, d.name as department_name, d.code as department_code, y.label as year_label
    FROM classes c
    JOIN departments d ON c.department_id = d.id
    JOIN academic_years y ON c.year_id = y.id
    ORDER BY c.name
  `).all();
  const sections = db.prepare(`
    SELECT s.*, c.name as class_name FROM sections s
    JOIN classes c ON s.class_id = c.id
    ORDER BY s.name
  `).all();
  const subjects = db.prepare(`
    SELECT sub.*, d.name as department_name, d.code as department_code
    FROM subjects sub
    JOIN departments d ON sub.department_id = d.id
    ORDER BY sub.name
  `).all();

  return res.json({
    success: true,
    departments,
    academicYears,
    classes,
    sections,
    subjects,
    data: {
      departments,
      academicYears,
      classes,
      sections,
      subjects
    }
  });
});

// GET /api/academic/departments
router.get('/departments', authenticate, (req, res) => {
  const departments = db.prepare(`SELECT * FROM departments ORDER BY name`).all();
  res.json({ success: true, departments, data: departments });
});

// GET /api/academic/classes
router.get('/classes', authenticate, (req, res) => {
  const classes = db.prepare(`
    SELECT c.*, d.name as department_name, d.code as department_code, y.label as year_label
    FROM classes c
    JOIN departments d ON c.department_id = d.id
    JOIN academic_years y ON c.year_id = y.id
    ORDER BY c.name
  `).all();
  res.json({ success: true, classes, data: classes });
});

// POST /api/academic/department
router.post('/department', authenticate, requireRole('admin'), (req, res) => {
  const { code, name } = req.body;
  if (!code || !name) {
    return res.status(400).json({ success: false, message: 'Code and name are required.' });
  }

  const id = uuidv4();
  db.prepare(`INSERT INTO departments (id, code, name) VALUES (?, ?, ?)`).run(id, code.trim().toUpperCase(), name.trim());
  return res.json({ success: true, message: 'Department created successfully.', id });
});

// POST /api/academic/class
router.post('/class', authenticate, requireRole('admin'), (req, res) => {
  const { name, code, department_id, year_id } = req.body;
  if (!name || !code || !department_id || !year_id) {
    return res.status(400).json({ success: false, message: 'All class fields are required.' });
  }

  const id = uuidv4();
  db.prepare(`INSERT INTO classes (id, department_id, year_id, name, code) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    department_id,
    year_id,
    name.trim(),
    code.trim().toUpperCase()
  );
  return res.json({ success: true, message: 'Class created successfully.', id });
});

// POST /api/academic/subject
router.post('/subject', authenticate, requireRole('admin'), (req, res) => {
  const { code, name, department_id, semester, credits } = req.body;
  if (!code || !name || !department_id) {
    return res.status(400).json({ success: false, message: 'Code, name, and department are required.' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO subjects (id, code, name, department_id, semester, credits)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, code.trim().toUpperCase(), name.trim(), department_id, semester || 1, credits || 3);
  return res.json({ success: true, message: 'Subject created successfully.', id });
});

module.exports = router;

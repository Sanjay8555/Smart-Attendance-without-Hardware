const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { db } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { logAuditEvent } = require('../services/misuseDetection.service');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const user = db.prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`).get(email.trim());

  if (!user) {
    logAuditEvent({
      action: 'FAILED_LOGIN',
      severity: 'warning',
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
      description: `Failed login attempt for non-existent email: ${email}`
    });
    return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ success: false, message: 'Account is suspended. Please contact administrator.' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    logAuditEvent({
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      action: 'FAILED_PASSWORD',
      severity: 'warning',
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
      description: `Failed login password attempt for user: ${user.name} (${user.email})`
    });
    return res.status(401).json({ success: false, message: 'Invalid password. Please check your credentials.' });
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );

  // Load role-specific profile
  let studentProfile = null;
  let facultyProfile = null;

  if (user.role === 'student') {
    studentProfile = db.prepare(`
      SELECT s.*, c.name as class_name, d.name as department_name, d.code as department_code,
             y.label as year_label, sec.name as section_name,
             (SELECT COUNT(*) FROM face_templates ft WHERE ft.student_id = s.id AND ft.consent_status = 1) as has_face_enrolled
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN academic_years y ON s.year_id = y.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE s.user_id = ?
    `).get(user.id);
  } else if (user.role === 'faculty') {
    facultyProfile = db.prepare(`
      SELECT f.*, d.name as department_name, d.code as department_code
      FROM faculty f
      LEFT JOIN departments d ON f.department_id = d.id
      WHERE f.user_id = ?
    `).get(user.id);
  }

  logAuditEvent({
    userId: user.id,
    userRole: user.role,
    userName: user.name,
    action: 'USER_LOGIN',
    severity: 'info',
    ipAddress: req.ip,
    deviceInfo: req.headers['user-agent'],
    description: `${user.role.toUpperCase()} logged in: ${user.name}`
  });

  return res.json({
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      avatar: user.avatar
    },
    student: studentProfile,
    faculty: facultyProfile
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  return res.json({
    success: true,
    user: req.user,
    student: req.student || null,
    faculty: req.faculty || null
  });
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  logAuditEvent({
    userId: req.user.id,
    userRole: req.user.role,
    userName: req.user.name,
    action: 'USER_LOGOUT',
    severity: 'info',
    ipAddress: req.ip,
    description: `User logged out: ${req.user.name}`
  });

  return res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/demo-accounts (Preconfigured quick login shortcuts for instant testing)
router.get('/demo-accounts', (req, res) => {
  const accounts = [
    {
      role: 'admin',
      name: 'Dr. Vikram Malhotra',
      title: 'Dean / Academic Admin',
      email: 'admin@college.edu',
      password: 'Admin@123',
      description: 'Full system control, rules configuration, geofences, reports & security audit'
    },
    {
      role: 'faculty',
      name: 'Prof. Rajesh Sharma',
      title: 'Head of CSE Department',
      email: 'faculty.sharma@college.edu',
      password: 'Faculty@123',
      description: 'Start live sessions, rotating Dynamic QR, OTP display & live attendee monitor'
    },
    {
      role: 'student',
      name: 'Alex Johnson (Face Enrolled)',
      title: 'CSE-3A Student (Roll: 22CS01)',
      email: 'alex@college.edu',
      password: 'Student@123',
      description: 'Mark attendance via Dynamic QR or Face Fallback + GPS Geofence + OTP'
    },
    {
      role: 'student',
      name: 'Rahul Mehta (Low Attendance)',
      title: 'CSE-3A Student (Roll: 22CS03)',
      email: 'rahul@college.edu',
      password: 'Student@123',
      description: 'Has <75% attendance alert banner, interactive attendance recovery meter'
    }
  ];

  return res.json({ success: true, accounts });
});

module.exports = router;

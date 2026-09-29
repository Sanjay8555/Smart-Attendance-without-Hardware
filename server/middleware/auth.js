const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { db } = require('../database/db');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    
    // Fetch fresh user from DB
    const user = db.prepare(`
      SELECT id, name, email, role, status, avatar FROM users WHERE id = ?
    `).get(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is suspended or inactive.' });
    }

    // Attach role-specific metadata
    if (user.role === 'student') {
      const student = db.prepare(`
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
      req.student = student;
    } else if (user.role === 'faculty') {
      const faculty = db.prepare(`
        SELECT f.*, d.name as department_name, d.code as department_code
        FROM faculty f
        LEFT JOIN departments d ON f.department_id = d.id
        WHERE f.user_id = ?
      `).get(user.id);
      req.faculty = faculty;
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
  }
}

function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. You do not have permission to access this resource (${allowedRoles.join(', ')} required).`
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRole
};

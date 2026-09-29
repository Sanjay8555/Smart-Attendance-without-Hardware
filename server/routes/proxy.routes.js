const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAuditEvent } = require('../services/misuseDetection.service');

function getSocketIo(req) {
  return req.app.get('io');
}

// GET /api/proxy - Get all proxies relevant to user
router.get('/', authenticate, (req, res) => {
  try {
    const isFaculty = req.user.role === 'faculty';
    const isAdmin = req.user.role === 'admin';

    let query = `
      SELECT fp.*,
             orig_u.name as original_faculty_name, orig_f.faculty_id as original_faculty_emp_id,
             sub_u.name as substitute_faculty_name, sub_f.faculty_id as substitute_faculty_emp_id,
             sub.name as subject_name, sub.code as subject_code,
             cls.name as class_name, cls.code as class_code,
             dept.name as department_name
      FROM faculty_proxies fp
      JOIN faculty orig_f ON fp.original_faculty_id = orig_f.id
      JOIN users orig_u ON orig_f.user_id = orig_u.id
      JOIN faculty sub_f ON fp.substitute_faculty_id = sub_f.id
      JOIN users sub_u ON sub_f.user_id = sub_u.id
      JOIN subjects sub ON fp.subject_id = sub.id
      JOIN classes cls ON fp.class_id = cls.id
      JOIN departments dept ON cls.department_id = dept.id
    `;

    const params = [];
    if (isFaculty && req.faculty) {
      query += ` WHERE fp.original_faculty_id = ? OR fp.substitute_faculty_id = ?`;
      params.push(req.faculty.id, req.faculty.id);
    }
    query += ` ORDER BY fp.date DESC, fp.created_at DESC LIMIT 100`;

    const records = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: records
    });
  } catch (err) {
    console.error('Failed to get proxies:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve proxy records.' });
  }
});

// GET /api/proxy/available-faculty - List other faculty members for substitute selection
router.get('/available-faculty', authenticate, (req, res) => {
  try {
    const currentFacultyId = req.faculty ? req.faculty.id : null;
    let query = `
      SELECT f.id, f.faculty_id as employee_id, f.designation, u.name, u.email, d.name as department_name
      FROM faculty f
      JOIN users u ON f.user_id = u.id
      LEFT JOIN departments d ON f.department_id = d.id
      WHERE u.is_active = 1
    `;
    const params = [];
    if (currentFacultyId) {
      query += ` AND f.id != ?`;
      params.push(currentFacultyId);
    }
    query += ` ORDER BY u.name ASC`;

    const list = db.prepare(query).all(...params);
    res.json({ success: true, faculty: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch available faculty.' });
  }
});

// POST /api/proxy/create - Create a new substitute proxy reassignment
router.post('/create', authenticate, (req, res) => {
  try {
    const {
      original_faculty_id,
      substitute_faculty_id,
      subject_id,
      class_id,
      section_id,
      date,
      period_name = 'Period 1',
      start_time,
      end_time,
      reason
    } = req.body;

    const actualOriginalId = (req.user.role === 'faculty' && req.faculty) ? req.faculty.id : original_faculty_id;

    if (!actualOriginalId || !substitute_faculty_id || !subject_id || !class_id || !date) {
      return res.status(400).json({
        success: false,
        message: 'Original faculty, substitute faculty, subject, class, and date are required.'
      });
    }

    if (actualOriginalId === substitute_faculty_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign yourself as the substitute proxy teacher.'
      });
    }

    const proxyId = uuidv4();
    const defaultStartTime = start_time || `${date}T09:00:00.000Z`;
    const defaultEndTime = end_time || `${date}T09:50:00.000Z`;

    db.prepare(`
      INSERT INTO faculty_proxies (
        id, original_faculty_id, substitute_faculty_id, subject_id, class_id, section_id,
        date, period_name, start_time, end_time, reason, status, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    `).run(
      proxyId,
      actualOriginalId,
      substitute_faculty_id,
      subject_id,
      class_id,
      section_id || null,
      date,
      period_name,
      defaultStartTime,
      defaultEndTime,
      reason || 'Academic leave / scheduled substitute lecture',
      req.user.id
    );

    // Notify substitute faculty
    const subUser = db.prepare(`SELECT user_id FROM faculty WHERE id = ?`).get(substitute_faculty_id);
    if (subUser) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, link)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        subUser.user_id,
        'Proxy Lecture Assignment',
        `You have been assigned as substitute teacher for ${period_name} on ${date}.`,
        'info',
        '/faculty/proxies'
      );
    }

    logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      userName: req.user.name,
      action: 'PROXY_TEACHER_ASSIGNED',
      severity: 'info',
      ipAddress: req.ip,
      description: `Proxy teacher reassignment created for date ${date}, period: ${period_name}.`
    });

    const io = getSocketIo(req);
    if (io) {
      io.emit('PROXY_UPDATED', { proxyId, date });
    }

    res.json({
      success: true,
      message: 'Proxy teacher reassignment created successfully.',
      proxyId
    });
  } catch (err) {
    console.error('Failed to create proxy:', err);
    res.status(500).json({ success: false, message: 'Failed to create proxy reassignment: ' + err.message });
  }
});

// PATCH /api/proxy/:id/status - Update proxy status (approved, cancelled, completed)
router.patch('/:id/status', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['approved', 'declined', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid proxy status.' });
    }

    const proxy = db.prepare(`SELECT * FROM faculty_proxies WHERE id = ?`).get(id);
    if (!proxy) {
      return res.status(404).json({ success: false, message: 'Proxy record not found.' });
    }

    db.prepare(`
      UPDATE faculty_proxies
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);

    logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      userName: req.user.name,
      action: `PROXY_${status.toUpperCase()}`,
      severity: status === 'cancelled' ? 'warning' : 'info',
      ipAddress: req.ip,
      description: `Proxy reassignment ${id} marked as ${status}.`
    });

    const io = getSocketIo(req);
    if (io) {
      io.emit('PROXY_UPDATED', { proxyId: id, status });
    }

    res.json({
      success: true,
      message: `Proxy assignment updated to ${status}.`
    });
  } catch (err) {
    console.error('Failed to update proxy status:', err);
    res.status(500).json({ success: false, message: 'Failed to update proxy status.' });
  }
});

module.exports = router;

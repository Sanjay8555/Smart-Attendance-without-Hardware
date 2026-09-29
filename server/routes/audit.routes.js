const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/audit/logs (Searchable, filterable audit and misuse logs)
router.get('/logs', authenticate, requireRole('admin'), (req, res) => {
  const { severity, action, limit = 50 } = req.query;

  let query = `SELECT * FROM audit_logs WHERE 1=1`;
  const params = [];

  if (severity) {
    query += ` AND severity = ?`;
    params.push(severity);
  }
  if (action) {
    query += ` AND action LIKE ?`;
    params.push(`%${action}%`);
  }

  query += ` ORDER BY timestamp DESC LIMIT ?`;
  params.push(parseInt(limit) || 50);

  const logs = db.prepare(query).all(...params);

  return res.json({ success: true, count: logs.length, data: logs });
});

// GET /api/audit/stats
router.get('/stats', authenticate, requireRole('admin'), (req, res) => {
  const totalLogs = db.prepare(`SELECT COUNT(*) as count FROM audit_logs`).get().count;
  const warnings = db.prepare(`SELECT COUNT(*) as count FROM audit_logs WHERE severity = 'warning'`).get().count;
  const dangers = db.prepare(`SELECT COUNT(*) as count FROM audit_logs WHERE severity = 'danger'`).get().count;
  const gpsBreaches = db.prepare(`SELECT COUNT(*) as count FROM audit_logs WHERE action LIKE '%GPS%'`).get().count;
  const otpFailures = db.prepare(`SELECT COUNT(*) as count FROM audit_logs WHERE action LIKE '%OTP%'`).get().count;
  const faceFailures = db.prepare(`SELECT COUNT(*) as count FROM audit_logs WHERE action LIKE '%FACE%'`).get().count;

  return res.json({
    success: true,
    stats: {
      totalLogs,
      warnings,
      dangers,
      gpsBreaches,
      otpFailures,
      faceFailures
    }
  });
});

module.exports = router;

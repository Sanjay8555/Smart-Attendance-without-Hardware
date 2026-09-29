const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const config = require('../config/config');
const { logAuditEvent } = require('../services/misuseDetection.service');

// GET /api/settings
router.get('/', authenticate, (req, res) => {
  const rows = db.prepare(`SELECT * FROM attendance_settings`).all();
  const settings = {};
  rows.forEach(r => {
    settings[r.key] = r.value;
  });

  return res.json({ success: true, settings });
});

// PUT /api/settings (Admin)
router.put('/', authenticate, requireRole('admin'), (req, res) => {
  const newSettings = req.body; // Key-value object
  if (!newSettings || typeof newSettings !== 'object') {
    return res.status(400).json({ success: false, message: 'Settings object required.' });
  }

  const updateSetting = db.prepare(`
    INSERT INTO attendance_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  const tx = db.transaction(() => {
    Object.entries(newSettings).forEach(([key, val]) => {
      updateSetting.run(key, String(val));
    });
  });

  tx();

  logAuditEvent({
    userId: req.user.id,
    userRole: req.user.role,
    userName: req.user.name,
    action: 'SETTINGS_UPDATED',
    severity: 'info',
    ipAddress: req.ip,
    description: `System attendance rules & security policies updated by admin.`
  });

  return res.json({ success: true, message: 'Attendance settings updated successfully.' });
});

// POST /api/settings/reset-defaults (Admin)
router.post('/reset-defaults', authenticate, requireRole('admin'), (req, res) => {
  const updateSetting = db.prepare(`
    INSERT INTO attendance_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  const tx = db.transaction(() => {
    Object.entries(config.DEFAULT_RULES).forEach(([key, val]) => {
      updateSetting.run(key, String(val));
    });
  });

  tx();

  return res.json({ success: true, message: 'Settings restored to factory defaults.' });
});

module.exports = router;

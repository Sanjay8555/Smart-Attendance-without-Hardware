const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAuditEvent } = require('../services/misuseDetection.service');

// GET /api/locations (All authenticated users)
router.get('/', authenticate, (req, res) => {
  const locations = db.prepare(`SELECT * FROM attendance_locations ORDER BY name ASC`).all();
  return res.json({ success: true, count: locations.length, data: locations });
});

// POST /api/locations (Admin)
router.post('/', authenticate, requireRole('admin'), (req, res) => {
  const { name, latitude, longitude, radius_meters, description } = req.body;

  if (!name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'Name, latitude, and longitude are required.' });
  }

  const id = uuidv4();
  const radius = parseFloat(radius_meters) || 100.0;

  db.prepare(`
    INSERT INTO attendance_locations (id, name, latitude, longitude, radius_meters, is_active, description)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(id, name.trim(), parseFloat(latitude), parseFloat(longitude), radius, description || null);

  logAuditEvent({
    userId: req.user.id,
    userRole: req.user.role,
    userName: req.user.name,
    action: 'LOCATION_CREATED',
    severity: 'info',
    ipAddress: req.ip,
    description: `Created new geofence location: ${name} (${radius}m radius)`
  });

  return res.json({ success: true, message: 'Geofence location created successfully.', id });
});

// PUT /api/locations/:id
router.put('/:id', authenticate, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, latitude, longitude, radius_meters, is_active, description } = req.body;

  const loc = db.prepare(`SELECT * FROM attendance_locations WHERE id = ?`).get(id);
  if (!loc) {
    return res.status(404).json({ success: false, message: 'Location not found.' });
  }

  db.prepare(`
    UPDATE attendance_locations
    SET name = COALESCE(?, name),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        radius_meters = COALESCE(?, radius_meters),
        is_active = COALESCE(?, is_active),
        description = COALESCE(?, description)
    WHERE id = ?
  `).run(
    name ? name.trim() : null,
    latitude !== undefined ? parseFloat(latitude) : null,
    longitude !== undefined ? parseFloat(longitude) : null,
    radius_meters !== undefined ? parseFloat(radius_meters) : null,
    is_active !== undefined ? (is_active ? 1 : 0) : null,
    description !== undefined ? description : null,
    id
  );

  return res.json({ success: true, message: 'Geofence location updated successfully.' });
});

// DELETE /api/locations/:id
router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  db.prepare(`DELETE FROM attendance_locations WHERE id = ?`).run(id);
  return res.json({ success: true, message: 'Geofence location removed.' });
});

module.exports = router;

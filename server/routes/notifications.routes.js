const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications (User's unread notifications)
router.get('/', authenticate, (req, res) => {
  const notifs = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(req.user.id);

  const unreadCount = notifs.filter(n => n.is_read === 0).length;

  return res.json({ success: true, count: notifs.length, unreadCount, data: notifs });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, (req, res) => {
  const { id } = req.params;
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(id, req.user.id);
  return res.json({ success: true, message: 'Notification marked as read.' });
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, (req, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(req.user.id);
  return res.json({ success: true, message: 'All notifications marked as read.' });
});

module.exports = router;

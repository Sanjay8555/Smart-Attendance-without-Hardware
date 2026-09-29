const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');

function logAuditEvent({
  userId = null,
  userRole = 'system',
  userName = 'System',
  action,
  severity = 'info', // 'info', 'warning', 'danger'
  sessionId = null,
  ipAddress = '127.0.0.1',
  deviceInfo = null,
  description,
  metadata = null
}) {
  try {
    const logId = uuidv4();
    const metadataStr = metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null;

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_role, user_name, action, severity, session_id, ip_address, device_info, description, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      userId,
      userRole,
      userName,
      action,
      severity,
      sessionId,
      ipAddress,
      deviceInfo,
      description,
      metadataStr
    );

    // If severity is warning or danger, create high-visibility notification for Admins
    if (severity === 'warning' || severity === 'danger') {
      const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all();
      const notifTitle = severity === 'danger' ? '🚨 High Security Alert' : '⚠️ Misuse Attempt Flagged';

      const insertNotif = db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, link)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      admins.forEach(admin => {
        insertNotif.run(
          uuidv4(),
          admin.id,
          notifTitle,
          description,
          severity === 'danger' ? 'danger' : 'warning',
          '/admin/audit'
        );
      });
    }

    return logId;
  } catch (err) {
    console.error('Failed to log audit event:', err);
    return null;
  }
}

module.exports = {
  logAuditEvent
};

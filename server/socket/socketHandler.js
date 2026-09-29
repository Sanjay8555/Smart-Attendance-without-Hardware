const { generateQrToken } = require('../services/qrToken.service');
const { db } = require('../database/db');

function setupSocket(io) {
  // Setup dynamic QR rotation background loop for active sessions
  setInterval(() => {
    try {
      const activeSessions = db.prepare(`SELECT id, qr_expires_at FROM attendance_sessions WHERE status = 'active'`).all();
      const now = new Date();

      activeSessions.forEach(sess => {
        const qrExpires = new Date(sess.qr_expires_at);
        // If expired or about to expire in 2 seconds, rotate token!
        if (now.getTime() >= qrExpires.getTime() - 2000) {
          const newQr = generateQrToken(sess.id, 15);
          io.to(`session_${sess.id}`).emit('QR_ROTATED', {
            sessionId: sess.id,
            qrToken: newQr.token,
            expiresAt: newQr.expiresAt,
            ttlSeconds: newQr.ttlSeconds
          });
        }
      });
    } catch (err) {
      // Quietly ignore during server reload
    }
  }, 3000);

  io.on('connection', (socket) => {
    // Join session room
    socket.on('JOIN_SESSION', (sessionId) => {
      if (sessionId) {
        socket.join(`session_${sessionId}`);
      }
    });

    socket.on('LEAVE_SESSION', (sessionId) => {
      if (sessionId) {
        socket.leave(`session_${sessionId}`);
      }
    });

    // Join user personal channel
    socket.on('JOIN_USER', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });
}

module.exports = { setupSocket };

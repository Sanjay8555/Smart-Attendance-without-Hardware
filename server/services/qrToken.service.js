const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');

function generateQrToken(sessionId, expirationSeconds = 15) {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const token = `ATT_QR_${sessionId.substring(0, 8)}_${randomBytes}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expirationSeconds * 1000).toISOString();

  // Invalidate previous active tokens for this session
  db.prepare(`
    UPDATE qr_tokens
    SET is_active = 0
    WHERE session_id = ? AND is_active = 1
  `).run(sessionId);

  // Insert new token into history
  const tokenId = uuidv4();
  db.prepare(`
    INSERT INTO qr_tokens (id, session_id, token, expires_at, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(tokenId, sessionId, token, expiresAt);

  // Update attendance session current token
  db.prepare(`
    UPDATE attendance_sessions
    SET current_qr_token = ?, qr_expires_at = ?
    WHERE id = ?
  `).run(token, expiresAt, sessionId);

  return {
    token,
    expiresAt,
    ttlSeconds: expirationSeconds
  };
}

function validateQrToken(sessionId, token) {
  if (!token || !sessionId) {
    return { isValid: false, reason: 'MISSING_TOKEN', message: 'QR token or session ID missing.' };
  }

  const tokenRecord = db.prepare(`
    SELECT * FROM qr_tokens
    WHERE session_id = ? AND token = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(sessionId, token);

  if (!tokenRecord) {
    return { isValid: false, reason: 'INVALID_TOKEN', message: 'Invalid QR code. Token was not found for this session.' };
  }

  const now = new Date();
  const expiresAt = new Date(tokenRecord.expires_at);

  if (now > expiresAt) {
    return {
      isValid: false,
      reason: 'EXPIRED_TOKEN',
      message: 'QR code has expired. Please scan the newly displayed rotating dynamic QR code.'
    };
  }

  return {
    isValid: true,
    tokenRecord
  };
}

module.exports = {
  generateQrToken,
  validateQrToken
};

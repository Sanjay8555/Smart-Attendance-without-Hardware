const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');

function generateOtp(sessionId, expirationSeconds = 600) {
  // Generate secure 6-digit numeric OTP
  const otpNumber = Math.floor(100000 + crypto.randomInt(0, 900000)).toString();
  const otpHash = bcrypt.hashSync(otpNumber, 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expirationSeconds * 1000).toISOString();

  // Save in otp_sessions
  db.prepare(`
    INSERT INTO otp_sessions (id, session_id, otp_hash, expires_at, attempt_count)
    VALUES (?, ?, ?, ?, 0)
  `).run(uuidv4(), sessionId, otpHash, expiresAt);

  // Update session
  db.prepare(`
    UPDATE attendance_sessions
    SET current_otp_hash = ?, current_otp_display = ?, otp_expires_at = ?
    WHERE id = ?
  `).run(otpHash, otpNumber, expiresAt, sessionId);

  return {
    otp: otpNumber,
    expiresAt,
    ttlSeconds: expirationSeconds
  };
}

function verifyOtp(sessionId, submittedOtp, maxAttempts = 5) {
  if (!submittedOtp) {
    return { isValid: false, reason: 'MISSING_OTP', message: 'OTP is required.' };
  }

  const session = db.prepare(`
    SELECT * FROM attendance_sessions WHERE id = ?
  `).get(sessionId);

  if (!session) {
    return { isValid: false, reason: 'SESSION_NOT_FOUND', message: 'Attendance session not found.' };
  }

  const latestOtpSession = db.prepare(`
    SELECT * FROM otp_sessions
    WHERE session_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(sessionId);

  if (!latestOtpSession) {
    return { isValid: false, reason: 'NO_OTP_SESSION', message: 'No active OTP session found.' };
  }

  if (latestOtpSession.attempt_count >= maxAttempts) {
    return {
      isValid: false,
      reason: 'MAX_ATTEMPTS_EXCEEDED',
      message: `Maximum OTP verification attempts (${maxAttempts}) exceeded for this session.`
    };
  }

  // Increment attempt count
  db.prepare(`
    UPDATE otp_sessions
    SET attempt_count = attempt_count + 1
    WHERE id = ?
  `).run(latestOtpSession.id);

  const now = new Date();
  const expiresAt = new Date(latestOtpSession.expires_at);

  if (now > expiresAt) {
    return { isValid: false, reason: 'EXPIRED_OTP', message: 'The session OTP has expired.' };
  }

  const isMatch = bcrypt.compareSync(submittedOtp.trim(), latestOtpSession.otp_hash);

  if (!isMatch) {
    return {
      isValid: false,
      reason: 'INVALID_OTP',
      message: `Incorrect OTP entered (${latestOtpSession.attempt_count + 1}/${maxAttempts} attempts used).`
    };
  }

  return {
    isValid: true,
    message: 'OTP verified successfully.'
  };
}

module.exports = {
  generateOtp,
  verifyOtp
};

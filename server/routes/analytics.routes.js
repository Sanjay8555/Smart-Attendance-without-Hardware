const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/analytics/dashboard (Charts and visual analytics data)
router.get('/dashboard', authenticate, (req, res) => {
  // 1. 14-Day Attendance Trend
  const sessions = db.prepare(`
    SELECT id, DATE(start_time) as date, period_name, total_present, total_late, total_absent, total_expected
    FROM attendance_sessions
    WHERE status = 'closed'
    ORDER BY start_time ASC
    LIMIT 14
  `).all();

  const trendLabels = sessions.map(s => s.date);
  const trendPresent = sessions.map(s => s.total_present);
  const trendLate = sessions.map(s => s.total_late);
  const trendAbsent = sessions.map(s => s.total_absent);

  // 2. Status Distribution
  const statusCounts = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late
    FROM attendance_records
  `).get();

  const totalClosedSessionsExpected = db.prepare(`
    SELECT SUM(total_absent) as absent FROM attendance_sessions WHERE status = 'closed'
  `).get()?.absent || 0;

  const distribution = {
    present: statusCounts.present || 0,
    late: statusCounts.late || 0,
    absent: totalClosedSessionsExpected
  };

  // 3. Verification Method Distribution
  const methods = db.prepare(`
    SELECT verification_method, COUNT(*) as count
    FROM attendance_records
    GROUP BY verification_method
  `).all();

  const methodBreakdown = {
    qr: 0,
    face: 0,
    manual: 0
  };
  methods.forEach(m => {
    if (m.verification_method.includes('qr')) methodBreakdown.qr += m.count;
    else if (m.verification_method.includes('face')) methodBreakdown.face += m.count;
    else methodBreakdown.manual += m.count;
  });

  // 4. Department Attendance Comparison
  const deptStats = db.prepare(`
    SELECT d.code, d.name,
           COUNT(DISTINCT s.id) as student_count,
           (SELECT COUNT(*) FROM attendance_records ar JOIN students st ON ar.student_id = st.id WHERE st.department_id = d.id) as attended_records
    FROM departments d
    LEFT JOIN students s ON s.department_id = d.id
    GROUP BY d.id
  `).all();

  // 5. Misuse & Security Alert Overview
  const alertCounts = db.prepare(`
    SELECT severity, COUNT(*) as count
    FROM audit_logs
    GROUP BY severity
  `).all();

  const securityAlerts = {
    info: 0,
    warning: 0,
    danger: 0
  };
  alertCounts.forEach(a => {
    securityAlerts[a.severity] = a.count;
  });

  return res.json({
    success: true,
    data: {
      trend: {
        labels: trendLabels,
        present: trendPresent,
        late: trendLate,
        absent: trendAbsent
      },
      distribution,
      methodBreakdown,
      departmentComparison: deptStats,
      securityAlerts
    }
  });
});

module.exports = router;

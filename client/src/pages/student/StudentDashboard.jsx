import React, { useState, useEffect } from 'react';
import {
  QrCode,
  ScanFace,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck,
  Sparkles,
  BookOpen,
  ArrowRight,
  Radio
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import StatCard from '../../components/StatCard';
import AttendanceGauge from '../../components/AttendanceGauge';
import UnifiedAttendanceModal from '../../components/UnifiedAttendanceModal';
import QrScannerModal from '../../components/QrScannerModal';
import FaceVerificationModal from '../../components/FaceVerificationModal';
import AttendanceSuccessModal from '../../components/AttendanceSuccessModal';
import StudentQrPassModal from '../../components/StudentQrPassModal';
import { getSocket } from '../../services/socket';

export default function StudentDashboard({ onNavigateHistory, onNavigateFace, onNavigateScan }) {
  const { student, user } = useAuth();
  const { showToast } = useNotification();

  const [activeSessions, setActiveSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isQrPassOpen, setIsQrPassOpen] = useState(false);
  const [selectedSessionForUnified, setSelectedSessionForUnified] = useState(null);
  const [selectedSessionForQr, setSelectedSessionForQr] = useState(null);
  const [selectedSessionForFace, setSelectedSessionForFace] = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sessRes, histRes] = await Promise.all([
        api.get('/session/active'),
        api.get('/attendance/student-history')
      ]);

      if (sessRes.success) {
        setActiveSessions(sessRes.activeSessions || []);
      }
      if (histRes.success) {
        setStats(histRes.stats);
      }
    } catch (err) {
      console.error('Failed to load student dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const socket = getSocket();
    socket.on('SESSION_STARTED', () => {
      loadData();
      showToast('A new attendance session has started for your class!', 'info');
    });

    socket.on('SESSION_CLOSED', () => {
      loadData();
    });

    return () => {
      socket.off('SESSION_STARTED');
      socket.off('SESSION_CLOSED');
    };
  }, []);

  const handleAttendanceSuccess = (result) => {
    setSuccessResult(result);
    loadData();
  };

  const percentage = stats?.percentage !== undefined ? stats.percentage : 0;
  const isLow = stats ? (stats.isLowAttendance || percentage < 75.0) : false;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Welcome, {user?.name}!
              </h2>
              {student?.roll_no && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Roll: {student.roll_no}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {student?.department_name} • Class: <strong className="text-slate-700">{student?.class_name}</strong> • {student?.year_label}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNavigateScan && (
              <button
                onClick={onNavigateScan}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer shadow-md shadow-indigo-600/20"
              >
                <QrCode className="w-4 h-4" />
                <span>Scan for Attendance</span>
              </button>
            )}

            <button
              onClick={() => setIsQrPassOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer shadow-xs"
            >
              <QrCode className="w-4 h-4 text-indigo-600" />
              <span>My QR Pass</span>
            </button>

            <button
              onClick={onNavigateFace}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
            >
              <ScanFace className="w-4 h-4 text-purple-600" />
              <span>Face Biometrics {student?.has_face_enrolled ? '✓ Enrolled' : '(Optional)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Low Attendance Critical Alert Bar (if < 75%) */}
      {isLow && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-amber-900">
                Low Attendance Alert ({percentage}% vs required 75.0%)
              </p>
              <p className="text-xs text-amber-700">
                You are currently below the institutional minimum threshold. Make sure to attend upcoming lectures.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateHistory}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shrink-0 cursor-pointer shadow-xs"
          >
            View Subject Breakdown
          </button>
        </div>
      )}

      {/* ACTIVE ATTENDANCE SESSIONS (LIVE ACTION CARDS) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-600 animate-pulse" />
            <h3 className="text-base font-bold text-slate-900">Live Attendance Sessions</h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {activeSessions.length} Active Now
          </span>
        </div>

        {activeSessions.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center shadow-xs">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No Active Attendance Session Right Now</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              When your faculty starts attendance for a lecture, the session card will automatically appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeSessions.map((sess) => {
              const alreadyMarked = sess.student_attendance_status;

              return (
                <div
                  key={sess.id}
                  className="p-6 rounded-3xl bg-white border-2 border-indigo-200 shadow-sm relative overflow-hidden"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                        {sess.subject_code}
                      </span>
                      <h4 className="text-lg font-bold text-slate-900">{sess.subject_name}</h4>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Live Now
                    </span>
                  </div>

                  <div className="my-4 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Faculty:</span>
                      <span className="font-bold text-slate-900">{sess.faculty_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Period:</span>
                      <span className="text-slate-700 font-medium">{sess.period_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-sky-600" /> Authorized Location:
                      </span>
                      <span className="text-sky-700 font-bold">{sess.location_name}</span>
                    </div>
                  </div>

                  {alreadyMarked ? (
                    <div className="mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-emerald-800 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Already Marked ({alreadyMarked.toUpperCase()})</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(sess.student_marked_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => setSelectedSessionForUnified(sess)}
                        className="flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Scan QR & Verify Face</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KPI METRIC CARDS & GAUGE ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overall Circular Gauge */}
        <div className="lg:col-span-1">
          <AttendanceGauge percentage={percentage} />
        </div>

        {/* Breakdown Metric StatCards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Classes Present"
            value={stats?.present || 0}
            subtitle="Timely check-ins"
            icon={CheckCircle2}
            color="emerald"
          />
          <StatCard
            title="Late Arrivals"
            value={stats?.late || 0}
            subtitle="Within grace period"
            icon={Clock}
            color="amber"
          />
          <StatCard
            title="Classes Missed"
            value={stats?.absent || 0}
            subtitle="Unexcused absences"
            icon={AlertTriangle}
            color="rose"
          />
        </div>
      </div>

      {/* UNIFIED 2-STEP ATTENDANCE MODAL (QR -> Camera Face Recognition -> Database Present/Absent) */}
      <UnifiedAttendanceModal
        isOpen={!!selectedSessionForUnified}
        session={selectedSessionForUnified}
        onClose={() => setSelectedSessionForUnified(null)}
        onSuccess={handleAttendanceSuccess}
      />

      <QrScannerModal
        isOpen={!!selectedSessionForQr}
        session={selectedSessionForQr}
        onClose={() => setSelectedSessionForQr(null)}
        onSuccess={handleAttendanceSuccess}
      />

      <FaceVerificationModal
        isOpen={!!selectedSessionForFace}
        session={selectedSessionForFace}
        onClose={() => setSelectedSessionForFace(null)}
        onSuccess={handleAttendanceSuccess}
      />

      <AttendanceSuccessModal
        isOpen={!!successResult}
        result={successResult}
        onClose={() => setSuccessResult(null)}
      />

      {/* Digital Student QR Pass Modal */}
      <StudentQrPassModal
        isOpen={isQrPassOpen}
        onClose={() => setIsQrPassOpen(false)}
      />
    </div>
  );
}

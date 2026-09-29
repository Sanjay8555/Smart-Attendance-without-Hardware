import React, { useState, useEffect } from 'react';
import {
  Radio,
  Pause,
  Play,
  StopCircle,
  RefreshCw,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  QrCode,
  ScanFace,
  UserCheck,
  MapPin,
  Search,
  SlidersHorizontal,
  Printer,
  X
} from 'lucide-react';
import { api } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { getSocket, joinSessionRoom, leaveSessionRoom } from '../../services/socket';
import { sound } from '../../services/sound';
import DynamicQrDisplay from '../../components/DynamicQrDisplay';
import PrintQrPosterModal from '../../components/PrintQrPosterModal';

export default function FacultyLiveSession({ onSessionClosed }) {
  const { showToast } = useNotification();
  const [session, setSession] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isPrintPosterOpen, setIsPrintPosterOpen] = useState(false);

  // Override Modal
  const [selectedStudentForOverride, setSelectedStudentForOverride] = useState(null);
  const [overrideStatus, setOverrideStatus] = useState('present');
  const [overrideReason, setOverrideReason] = useState('Authorized medical leave / faulty device camera');
  const [isOverriding, setIsOverriding] = useState(false);

  // Time remaining countdown
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(2400);

  const loadSession = async () => {
    try {
      setLoading(true);
      const res = await api.get('/session/active');
      if (res.success && res.session) {
        setSession(res.session);
        joinSessionRoom(res.session.id);
        loadAttendees(res.session.id);

        const end = new Date(res.session.end_time).getTime();
        const now = new Date().getTime();
        setTimeRemainingSeconds(Math.max(0, Math.floor((end - now) / 1000)));
      } else {
        setSession(null);
      }
    } catch (err) {
      console.error('Failed to load active session:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendees = async (sessionId) => {
    try {
      const res = await api.get(`/session/${sessionId}/attendees`);
      if (res.success) {
        setAttendees(res.data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadSession();

    const socket = getSocket();

    socket.on('QR_ROTATED', (data) => {
      setSession((prev) => (prev ? { ...prev, current_qr_token: data.qrToken } : prev));
    });

    socket.on('OTP_UPDATED', (data) => {
      setSession((prev) => (prev ? { ...prev, current_otp_display: data.otp } : prev));
    });

    socket.on('STUDENT_CHECKED_IN', (data) => {
      sound.playSuccess();
      showToast(`⚡ ${data.student.name} (${data.student.roll_no}) checked in!`, 'success');
      setSession((prev) => {
        if (!prev) return prev;
        const isPres = data.student.status === 'present';
        return {
          ...prev,
          total_present: isPres ? prev.total_present + 1 : prev.total_present,
          total_late: !isPres ? prev.total_late + 1 : prev.total_late
        };
      });
      if (session?.id) loadAttendees(session.id);
    });

    socket.on('ATTENDANCE_OVERRIDDEN', () => {
      if (session?.id) loadAttendees(session.id);
    });

    return () => {
      if (session?.id) leaveSessionRoom(session.id);
      socket.off('QR_ROTATED');
      socket.off('OTP_UPDATED');
      socket.off('STUDENT_CHECKED_IN');
      socket.off('ATTENDANCE_OVERRIDDEN');
    };
  }, []);

  // Ticker for session countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRotateQr = async () => {
    if (!session) return;
    try {
      const res = await api.post(`/session/${session.id}/rotate-qr`);
      if (res.success) {
        setSession((prev) => ({ ...prev, current_qr_token: res.token }));
        showToast('Dynamic QR Token rotated manually.', 'info');
      }
    } catch (e) {}
  };

  const handleRegenerateOtp = async () => {
    if (!session) return;
    try {
      const res = await api.post(`/session/${session.id}/regenerate-otp`);
      if (res.success) {
        setSession((prev) => ({ ...prev, current_otp_display: res.otp }));
        showToast('New Session OTP generated.', 'info');
      }
    } catch (e) {}
  };

  const handleTogglePause = async () => {
    if (!session) return;
    const isPaused = session.status === 'paused';
    try {
      if (isPaused) {
        await api.post(`/session/${session.id}/resume`);
        setSession((prev) => ({ ...prev, status: 'active' }));
        showToast('Attendance session resumed.', 'success');
      } else {
        await api.post(`/session/${session.id}/pause`);
        setSession((prev) => ({ ...prev, status: 'paused' }));
        showToast('Attendance session paused.', 'warning');
      }
    } catch (e) {}
  };

  const handleCloseSession = async () => {
    if (!session) return;
    if (!window.confirm('Are you sure you want to finalize and close attendance for this lecture? Missing students will be marked absent.')) {
      return;
    }
    try {
      const res = await api.post(`/session/${session.id}/close`);
      if (res.success) {
        showToast('Attendance session finalized and closed.', 'success');
        if (onSessionClosed) onSessionClosed();
      }
    } catch (e) {}
  };

  const handleSaveOverride = async () => {
    if (!selectedStudentForOverride || !overrideReason) {
      showToast('Please provide a valid correction reason for audit records.', 'warning');
      return;
    }

    setIsOverriding(true);
    try {
      const res = await api.post('/attendance/override', {
        session_id: session.id,
        student_id: selectedStudentForOverride.student_id,
        new_status: overrideStatus,
        reason: overrideReason.trim()
      });

      if (res.success) {
        showToast(`Attendance updated for ${selectedStudentForOverride.student_name}`, 'success');
        setSelectedStudentForOverride(null);
        loadAttendees(session.id);
      }
    } catch (err) {
      showToast(err.message || 'Override failed', 'error');
    } finally {
      setIsOverriding(false);
    }
  };

  if (!session) {
    return (
      <div className="p-12 rounded-3xl bg-white text-center border border-slate-200 shadow-xs space-y-4">
        <Radio className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900">No Live Attendance Session Active</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          You do not have any open attendance session running. Launch a new session from the dashboard to display dynamic QR and OTP.
        </p>
      </div>
    );
  }

  const filteredAttendees = attendees.filter((a) => {
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchSearch =
      !searchQuery ||
      a.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.roll_no.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const presentCount = attendees.filter((a) => a.status === 'present').length;
  const lateCount = attendees.filter((a) => a.status === 'late').length;
  const absentCount = attendees.filter((a) => a.status === 'absent').length;

  return (
    <div className="space-y-6">
      {/* Top Session Control Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                session.status === 'active' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
              }`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
              {session.subject_code} • {session.period_name}
            </span>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                session.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {session.status}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {session.subject_name}
          </h2>
          <p className="text-xs text-slate-500">
            Class: <strong className="text-slate-800">{session.class_name}</strong> • Campus Zone: <strong className="text-sky-700">{session.location_name}</strong> ({session.location_radius}m radius)
          </p>
        </div>

        {/* Session Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPrintPosterOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" /> Print QR Poster / Display
          </button>

          <button
            onClick={handleTogglePause}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
              session.status === 'paused'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
            }`}
          >
            {session.status === 'paused' ? (
              <>
                <Play className="w-3.5 h-3.5" /> Resume Attendance
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" /> Pause Session
              </>
            )}
          </button>

          <button
            onClick={handleCloseSession}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <StopCircle className="w-3.5 h-3.5" /> Close & Finalize
          </button>
        </div>
      </div>

      {/* Real-time Counts Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center border-l-4 border-l-emerald-500">
          <p className="text-xs text-slate-500 font-bold uppercase">Present</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{presentCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center border-l-4 border-l-amber-500">
          <p className="text-xs text-slate-500 font-bold uppercase">Late</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{lateCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center border-l-4 border-l-rose-500">
          <p className="text-xs text-slate-500 font-bold uppercase">Absent</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{absentCount}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center border-l-4 border-l-indigo-500">
          <p className="text-xs text-slate-500 font-bold uppercase">Expected</p>
          <p className="text-2xl font-black text-indigo-700 mt-1">{session.total_expected}</p>
        </div>
      </div>

      {/* Main Grid: Left Column = Dynamic QR & OTP, Right Column = Real-time Student Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <DynamicQrDisplay
            session={session}
            onRotateQr={handleRotateQr}
            onRegenerateOtp={handleRegenerateOtp}
            timeRemainingSeconds={timeRemainingSeconds}
            presentCount={presentCount + lateCount}
            expectedCount={session.total_expected}
          />
        </div>

        {/* Live Attendees Roster & Manual Override Manager */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Live Student Roster</h3>
                <span className="text-xs text-slate-500">({attendees.length} Students)</span>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present ({presentCount})</option>
                  <option value="late">Late ({lateCount})</option>
                  <option value="absent">Absent ({absentCount})</option>
                </select>
              </div>
            </div>

            {/* Attendees Table */}
            <div className="max-h-[480px] overflow-y-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Student Name</th>
                    <th className="px-3 py-2.5">Student ID</th>
                    <th className="px-3 py-2.5">Subject</th>
                    <th className="px-3 py-2.5">Date & Time</th>
                    <th className="px-3 py-2.5">Present / Absent</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAttendees.map((st) => (
                    <tr key={st.student_id} className="hover:bg-slate-50/80 transition">
                      <td className="px-3 py-3">
                        <span className="font-bold text-slate-900 block">{st.student_name}</span>
                        <span className="text-[10px] text-slate-500">{st.email || 'alex@college.edu'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs font-bold text-indigo-700">{st.roll_no}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-semibold text-slate-800 block">{session.subject_name}</span>
                        <span className="text-[10px] text-slate-500">{session.subject_code}</span>
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-600">
                        {st.timestamp ? (
                          <>
                            <span>{new Date(st.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            <span className="block text-[10px] text-slate-400">{new Date(st.timestamp).toLocaleDateString()}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">Pending</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                            st.status === 'present'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : st.status === 'late'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${st.status === 'present' ? 'bg-emerald-600' : st.status === 'late' ? 'bg-amber-600' : 'bg-rose-600'}`} />
                          {st.status === 'present' ? 'PRESENT' : st.status === 'late' ? 'LATE' : 'ABSENT'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedStudentForOverride(st);
                            setOverrideStatus(st.status === 'absent' ? 'present' : st.status);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 transition cursor-pointer"
                        >
                          Correct Status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MANUAL CORRECTION MODAL */}
      {selectedStudentForOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Manual Attendance Override</h3>
              </div>
              <button
                onClick={() => setSelectedStudentForOverride(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <p className="text-slate-500">Student:</p>
                <p className="font-bold text-slate-900 text-sm">
                  {selectedStudentForOverride.student_name} ({selectedStudentForOverride.roll_no})
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Attendance Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="present">Present (Full credit)</option>
                  <option value="late">Late (Grace arrival)</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Correction Reason <span className="text-rose-600">* (Logged in Audit Trail)</span>
                </label>
                <textarea
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Device camera malfunction verified by faculty, official college duty..."
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setSelectedStudentForOverride(null)}
                  className="w-1/3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOverride}
                  disabled={isOverriding || !overrideReason.trim()}
                  className="w-2/3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition cursor-pointer shadow-xs"
                >
                  {isOverriding ? 'Updating...' : 'Save & Log Override'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable QR Code Poster Modal */}
      <PrintQrPosterModal
        isOpen={isPrintPosterOpen}
        session={session}
        onClose={() => setIsPrintPosterOpen(false)}
      />
    </div>
  );
}

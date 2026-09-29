import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Radio,
  Plus,
  QrCode,
  ScanFace,
  MapPin,
  Clock,
  CheckCircle2,
  Users,
  Layers,
  ChevronRight,
  Sparkles,
  X
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import StatCard from '../../components/StatCard';

export default function FacultyDashboard({ onOpenLiveRoom }) {
  const { faculty, user } = useAuth();
  const { showToast } = useNotification();

  const [assignments, setAssignments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [academicStructure, setAcademicStructure] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // New Session Launch Modal
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [formPeriod, setFormPeriod] = useState('Period 2 (11:00 AM - 11:50 AM)');
  const [formLocationId, setFormLocationId] = useState('');
  const [formMode, setFormMode] = useState('qr_otp');
  const [formAllowFallback, setFormAllowFallback] = useState(true);
  const [formDuration, setFormDuration] = useState('45');
  const [isLaunching, setIsLaunching] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [structRes, locRes, activeRes] = await Promise.all([
        api.get('/academic/structure'),
        api.get('/locations'),
        api.get('/session/active')
      ]);

      if (structRes.success) {
        setAcademicStructure(structRes.data);
        if (structRes.data.subjects.length > 0) setFormSubjectId(structRes.data.subjects[0].id);
        if (structRes.data.classes.length > 0) setFormClassId(structRes.data.classes[0].id);
      }
      if (locRes.success) {
        setLocations(locRes.data);
        if (locRes.data.length > 0) setFormLocationId(locRes.data[0].id);
      }
      if (activeRes.success) {
        setActiveSession(activeRes.session || null);
      }
    } catch (err) {
      console.error('Failed to load faculty dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLaunchSession = async (e) => {
    e.preventDefault();
    if (!formSubjectId || !formClassId || !formLocationId) {
      showToast('Please select Subject, Class, and Campus Location.', 'warning');
      return;
    }

    setIsLaunching(true);
    try {
      const res = await api.post('/session/start', {
        subject_id: formSubjectId,
        class_id: formClassId,
        location_id: formLocationId,
        period_name: formPeriod,
        attendance_mode: formMode,
        allow_face_fallback: formAllowFallback,
        duration_minutes: parseInt(formDuration) || 45
      });

      if (res.success) {
        showToast('Live attendance session started successfully!', 'success');
        setIsLaunchModalOpen(false);
        onOpenLiveRoom();
      }
    } catch (err) {
      showToast(err.message || 'Failed to start session', 'error');
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Faculty Profile Hero */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {user?.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {faculty?.designation || 'Faculty'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Department: <strong className="text-slate-700">{faculty?.department_name}</strong> • ID: <strong className="text-slate-700">{faculty?.faculty_id || 'FAC-CSE-01'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeSession ? (
              <button
                onClick={onOpenLiveRoom}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm cursor-pointer"
              >
                <Radio className="w-4 h-4 animate-pulse" /> Return to Live Session
              </button>
            ) : (
              <button
                onClick={() => setIsLaunchModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Launch Attendance Session
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ACTIVE SESSION BANNER IF RUNNING */}
      {activeSession && (
        <div className="p-5 rounded-3xl bg-emerald-50/60 border-2 border-emerald-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-700 shrink-0">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Live Attendance Active
                </span>
                <span className="text-xs text-slate-500">{activeSession.period_name}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {activeSession.subject_name} ({activeSession.class_name})
              </h3>
              <p className="text-xs text-slate-600">
                OTP: <strong className="text-amber-700 font-mono text-sm font-black">{activeSession.current_otp_display}</strong> • Present: <strong className="text-emerald-700 font-bold">{activeSession.total_present}</strong> / {activeSession.total_expected}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenLiveRoom}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <span>Open Dynamic QR Screen</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* QUICK STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Assigned Subjects"
          value={academicStructure?.subjects?.length || 3}
          subtitle="Semester Courses"
          icon={BookOpen}
          color="indigo"
        />
        <StatCard
          title="Campus Geofences"
          value={locations?.length || 3}
          subtitle="Authorized Attendance Zones"
          icon={MapPin}
          color="sky"
        />
        <StatCard
          title="Attendance Mode"
          value="QR + Face + OTP"
          subtitle="Hardware-Free Multimodal"
          icon={QrCode}
          color="purple"
        />
      </div>

      {/* ASSIGNED SUBJECTS & CLASSES CARDS */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Your Courses & Classes
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {academicStructure?.subjects?.map((sub) => (
            <div key={sub.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {sub.code}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 mt-1.5">{sub.name}</h4>
                </div>
                <span className="text-xs text-slate-500 font-medium">Credits: {sub.credits}</span>
              </div>
              <p className="text-xs text-slate-500">
                Department: {sub.department_name} • Semester {sub.semester}
              </p>
              <button
                onClick={() => {
                  setFormSubjectId(sub.id);
                  setIsLaunchModalOpen(true);
                }}
                className="w-full py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-indigo-600 hover:text-white text-slate-700 border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Start Attendance for Course
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* LAUNCH ATTENDANCE MODAL */}
      {isLaunchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Launch Attendance Session</h2>
                  <p className="text-xs text-slate-500">Dynamic QR + Geofence + OTP Generation</p>
                </div>
              </div>
              <button
                onClick={() => setIsLaunchModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLaunchSession} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                <select
                  value={formSubjectId}
                  onChange={(e) => setFormSubjectId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                >
                  {academicStructure?.subjects?.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Class / Section</label>
                  <select
                    value={formClassId}
                    onChange={(e) => setFormClassId(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    {academicStructure?.classes?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.department_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Period Name</label>
                  <input
                    type="text"
                    value={formPeriod}
                    onChange={(e) => setFormPeriod(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Campus Geofence Location</label>
                <select
                  value={formLocationId}
                  onChange={(e) => setFormLocationId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} (Radius: {loc.radius_meters}m)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Attendance Mode</label>
                  <select
                    value={formMode}
                    onChange={(e) => setFormMode(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="qr_otp">Mode 1: Dynamic QR + GPS + OTP (Default)</option>
                    <option value="face_otp">Mode 2: Face Liveness + GPS + OTP</option>
                    <option value="qr_face_otp">Mode 3: Combined (QR / Face + GPS + OTP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formAllowFallback}
                  onChange={(e) => setFormAllowFallback(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-slate-700 font-medium">
                  Allow camera face verification fallback if student QR scan fails
                </span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLaunchModalOpen(false)}
                  className="w-1/3 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLaunching}
                  className="w-2/3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {isLaunching ? 'Launching...' : 'Start Session Now →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

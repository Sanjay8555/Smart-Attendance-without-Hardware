import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  BookOpen,
  Plus,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
  ShieldAlert,
  Radio,
  RefreshCw,
  Search,
  Building2,
  Sparkles
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

export default function FacultyProxyPage({ onLaunchSession }) {
  const { user, faculty, isAdmin } = useAuth();
  const { showToast } = useNotification();

  const [proxies, setProxies] = useState([]);
  const [availableFaculty, setAvailableFaculty] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter tab: 'all' | 'substitute_for_me' | 'delegated_by_me'
  const [activeTab, setActiveTab] = useState('delegated_to_me');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    substitute_faculty_id: '',
    subject_id: '',
    class_id: '',
    date: new Date().toISOString().split('T')[0],
    period_name: 'Period 1 (09:00 - 09:50 AM)',
    reason: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [proxRes, facRes, acadRes] = await Promise.all([
        api.get('/proxy'),
        api.get('/proxy/available-faculty'),
        api.get('/academic/structure')
      ]);

      if (proxRes.success) setProxies(proxRes.data || []);
      if (facRes.success) setAvailableFaculty(facRes.faculty || []);
      if (acadRes.success) {
        const classList = acadRes.classes || acadRes.data?.classes || [];
        const subjList = acadRes.subjects || acadRes.data?.subjects || [];
        setClasses(classList);
        setSubjects(subjList);
        if (classList.length > 0 && !formData.class_id) {
          setFormData((prev) => ({ ...prev, class_id: classList[0].id }));
        }
        if (subjList.length > 0 && !formData.subject_id) {
          setFormData((prev) => ({ ...prev, subject_id: subjList[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load proxy data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProxy = async (e) => {
    e.preventDefault();
    if (!formData.substitute_faculty_id || !formData.subject_id || !formData.class_id || !formData.date) {
      showToast('Please fill in all required fields.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/proxy/create', formData);
      if (res.success) {
        showToast('✓ Proxy teacher reassignment created successfully!', 'success');
        setIsCreateModalOpen(false);
        setFormData({
          substitute_faculty_id: '',
          subject_id: '',
          class_id: '',
          date: new Date().toISOString().split('T')[0],
          period_name: 'Period 1 (09:00 - 09:50 AM)',
          reason: ''
        });
        loadData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create proxy', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (proxyId, newStatus) => {
    try {
      const res = await api.patch(`/proxy/${proxyId}/status`, { status: newStatus });
      if (res.success) {
        showToast(`Proxy status updated to ${newStatus}.`, 'info');
        loadData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  // Filter proxies based on tab
  const filteredProxies = proxies.filter((p) => {
    const matchesSearch =
      (p.subject_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.class_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.original_faculty_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.substitute_faculty_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'delegated_to_me') {
      return faculty ? p.substitute_faculty_id === faculty.id : true;
    } else if (activeTab === 'requested_by_me') {
      return faculty ? p.original_faculty_id === faculty.id : true;
    }
    return true;
  });

  const mySubstitutionsCount = proxies.filter((p) => faculty && p.substitute_faculty_id === faculty.id).length;
  const myRequestsCount = proxies.filter((p) => faculty && p.original_faculty_id === faculty.id).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Faculty Proxy & Substitute Management</h2>
              <p className="text-xs text-slate-500">
                Delegate attendance authority and take substitute lectures with full audit tracking
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Assign Substitute Teacher</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Classes Assigned to Me</span>
            <span className="text-2xl font-black text-indigo-600 mt-1 block font-mono">{mySubstitutionsCount}</span>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold block">My Reassigned Requests</span>
            <span className="text-2xl font-black text-purple-600 mt-1 block font-mono">{myRequestsCount}</span>
          </div>
          <div className="p-3 rounded-2xl bg-purple-50 text-purple-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold block">Total Institution Proxies</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-mono">{proxies.length}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-100 text-slate-700">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* TABS & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('delegated_to_me')}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
              activeTab === 'delegated_to_me'
                ? 'bg-white text-indigo-600 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Assigned to Me ({mySubstitutionsCount})
          </button>
          <button
            onClick={() => setActiveTab('requested_by_me')}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
              activeTab === 'requested_by_me'
                ? 'bg-white text-indigo-600 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Delegations ({myRequestsCount})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-indigo-600 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Logs ({proxies.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search subject, faculty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* PROXY REASSIGNMENT LIST */}
      {filteredProxies.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center shadow-xs space-y-3">
          <UserCheck className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Proxy Reassignments Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === 'delegated_to_me'
              ? 'You have not been assigned as a substitute teacher for any lectures yet.'
              : 'You have not delegated any lectures to substitute teachers.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProxies.map((p) => {
            const isMeSubstitute = faculty && p.substitute_faculty_id === faculty.id;
            const isMeOriginal = faculty && p.original_faculty_id === faculty.id;

            return (
              <div
                key={p.id}
                className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 relative overflow-hidden"
              >
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 font-mono">
                      {p.subject_code} • {p.class_name}
                    </span>
                    <h4 className="text-base font-bold text-slate-900 mt-0.5">{p.subject_name}</h4>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      p.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : p.status === 'cancelled'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Original Faculty</span>
                    <strong className="text-slate-900 block font-semibold">{p.original_faculty_name}</strong>
                    <span className="text-[10px] text-slate-500">{p.original_faculty_emp_id}</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-1">
                    <span className="text-[10px] text-indigo-700 block uppercase font-bold">Substitute Teacher</span>
                    <strong className="text-indigo-950 block font-semibold">{p.substitute_faculty_name}</strong>
                    <span className="text-[10px] text-indigo-600">{p.substitute_faculty_emp_id}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Date: <strong className="text-slate-800">{p.date}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Slot: <strong className="text-slate-800">{p.period_name}</strong></span>
                  </div>
                  {p.reason && (
                    <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-100">
                      Note: "{p.reason}"
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  {isMeSubstitute && p.status === 'approved' && onLaunchSession && (
                    <button
                      onClick={() => onLaunchSession(p)}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5" /> Launch Attendance Session
                    </button>
                  )}

                  {isMeOriginal && p.status === 'approved' && (
                    <button
                      onClick={() => handleStatusUpdate(p.id, 'cancelled')}
                      className="py-1.5 px-3 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                    >
                      Cancel Delegation
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE PROXY MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Assign Substitute Teacher</h3>
                  <p className="text-xs text-slate-500">Delegate lecture and attendance authority</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProxy} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Substitute Faculty Colleague *</label>
                <select
                  value={formData.substitute_faculty_id}
                  onChange={(e) => setFormData({ ...formData, substitute_faculty_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  required
                >
                  <option value="">-- Select Faculty Colleague --</option>
                  {availableFaculty.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.employee_id}) - {f.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Subject *</label>
                  <select
                    value={formData.subject_id}
                    onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    required
                  >
                    <option value="">-- Select Subject --</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Class / Section *</label>
                  <select
                    value={formData.class_id}
                    onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    required
                  >
                    <option value="">-- Select Class --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Reassignment Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Lecture Period *</label>
                  <select
                    value={formData.period_name}
                    onChange={(e) => setFormData({ ...formData, period_name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="Period 1 (09:00 - 09:50 AM)">Period 1 (09:00 - 09:50 AM)</option>
                    <option value="Period 2 (10:00 - 10:50 AM)">Period 2 (10:00 - 10:50 AM)</option>
                    <option value="Period 3 (11:10 - 12:00 PM)">Period 3 (11:10 - 12:00 PM)</option>
                    <option value="Period 4 (01:00 - 01:50 PM)">Period 4 (01:00 - 01:50 PM)</option>
                    <option value="Period 5 (02:00 - 02:50 PM)">Period 5 (02:00 - 02:50 PM)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Reason / Academic Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Conference attendance, medical leave, lab session..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
                >
                  {submitting ? 'Assigning...' : 'Confirm Proxy Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

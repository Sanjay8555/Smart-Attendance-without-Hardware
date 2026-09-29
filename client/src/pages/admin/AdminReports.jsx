import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Users,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { api } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

export default function AdminReports() {
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'subjects'
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stuRes, subRes] = await Promise.all([
        api.get('/reports/students'),
        api.get('/reports/subjects')
      ]);

      if (stuRes.success) setStudents(stuRes.data);
      if (subRes.success) setSubjects(subRes.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExportExcel = async () => {
    try {
      showToast('Preparing Excel workbook...', 'info');
      await api.downloadFile('/reports/export-excel', 'Institutional_Attendance_Report.xlsx');
      showToast('Excel report downloaded successfully!', 'success');
    } catch (e) {
      showToast('Export failed', 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      showToast('Preparing CSV records...', 'info');
      await api.downloadFile('/reports/export-csv', 'Institutional_Attendance_Logs.csv');
      showToast('CSV logs downloaded successfully!', 'success');
    } catch (e) {
      showToast('Export failed', 'error');
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchLow = !lowOnly || s.isLowAttendance;
    const matchSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.className.toLowerCase().includes(searchQuery.toLowerCase());
    return matchLow && matchSearch;
  });

  const filteredSubjects = subjects.filter(
    (sub) =>
      !searchQuery ||
      sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Institutional Reports & Data Export</h2>
          <p className="text-xs text-slate-500">Generate compliance rosters, low-attendance alerts, and export data</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" /> Export Raw CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Download Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="p-4 rounded-2xl glass-panel flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'students'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            Student Compliance ({students.length})
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'subjects'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            Subject Performance ({subjects.length})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {activeTab === 'students' && (
            <label className="flex items-center gap-2 text-xs text-amber-700 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={lowOnly}
                onChange={(e) => setLowOnly(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
              />
              <span>Filter Low Attendance (&lt;75%)</span>
            </label>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search query..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* STUDENT REPORTS TABLE */}
      {activeTab === 'students' && (
        <div className="rounded-3xl glass-card overflow-hidden border border-slate-200 shadow-sm bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Roll No</th>
                  <th className="px-5 py-3.5">Student Name</th>
                  <th className="px-5 py-3.5">Class / Dept</th>
                  <th className="px-5 py-3.5">Conducted</th>
                  <th className="px-5 py-3.5">Present</th>
                  <th className="px-5 py-3.5">Late</th>
                  <th className="px-5 py-3.5">Absent</th>
                  <th className="px-5 py-3.5">Attendance %</th>
                  <th className="px-5 py-3.5">Recovery Deficit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredStudents.map((st) => (
                  <tr key={st.studentId} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">{st.rollNo}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-800 block">{st.name}</span>
                      <span className="text-[10px] text-slate-400">{st.email}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-700 block">{st.className}</span>
                      <span className="text-[10px] text-slate-500">{st.departmentName}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">{st.totalClasses}</td>
                    <td className="px-5 py-3.5 font-mono text-emerald-600 font-bold">{st.present}</td>
                    <td className="px-5 py-3.5 font-mono text-amber-600 font-bold">{st.late}</td>
                    <td className="px-5 py-3.5 font-mono text-rose-600 font-bold">{st.absent}</td>
                    <td className="px-5 py-3.5 font-mono font-extrabold text-sm whitespace-nowrap">
                      <span className={st.isLowAttendance ? 'text-amber-600' : 'text-emerald-600'}>
                        {st.percentage}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {st.isLowAttendance ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Needs {st.recoveryClassesNeeded} classes to reach 75%
                        </span>
                      ) : (
                        <span className="text-emerald-600 text-[11px] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Eligible
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBJECT REPORTS TABLE */}
      {activeTab === 'subjects' && (
        <div className="rounded-3xl glass-card overflow-hidden border border-slate-200 shadow-sm bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Subject Code</th>
                  <th className="px-5 py-3.5">Subject Name</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Total Sessions Conducted</th>
                  <th className="px-5 py-3.5">Average Turnout %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSubjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 whitespace-nowrap">
                      {sub.code}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">{sub.name}</td>
                    <td className="px-5 py-3.5 text-slate-600">{sub.department}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">{sub.totalSessions}</td>
                    <td className="px-5 py-3.5 font-mono font-extrabold text-sm text-emerald-600">
                      {sub.attendancePercentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

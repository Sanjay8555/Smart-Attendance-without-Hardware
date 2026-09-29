import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  BookOpen,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search
} from 'lucide-react';
import { api } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

export default function FacultyReports() {
  const { showToast } = useNotification();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowOnly, setFilterLowOnly] = useState(false);

  const loadReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/students');
      if (res.success) {
        setStudents(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleExportExcel = async () => {
    try {
      showToast('Preparing Excel export...', 'info');
      await api.downloadFile('/reports/export-excel', 'Faculty_Attendance_Report.xlsx');
      showToast('Excel report downloaded successfully!', 'success');
    } catch (e) {
      showToast('Failed to export Excel file', 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      showToast('Preparing CSV logs...', 'info');
      await api.downloadFile('/reports/export-csv', 'Faculty_Attendance_Logs.csv');
      showToast('CSV logs downloaded successfully!', 'success');
    } catch (e) {
      showToast('Failed to export CSV file', 'error');
    }
  };

  const filtered = students.filter((s) => {
    const matchLow = !filterLowOnly || s.isLowAttendance;
    const matchSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.className.toLowerCase().includes(searchQuery.toLowerCase());
    return matchLow && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Class Attendance Reports & Records</h2>
          <p className="text-xs text-slate-500">Review cumulative attendance percentages and export verified registers</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" /> Export CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student name or roll..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-amber-800 font-bold cursor-pointer">
          <input
            type="checkbox"
            checked={filterLowOnly}
            onChange={(e) => setFilterLowOnly(e.target.checked)}
            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
          />
          <span>Show Only Low Attendance (&lt; 75%)</span>
        </label>
      </div>

      {/* Students Table */}
      <div className="rounded-3xl bg-white overflow-hidden border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Roll No</th>
                <th className="px-5 py-3.5">Student Name</th>
                <th className="px-5 py-3.5">Class</th>
                <th className="px-5 py-3.5">Conducted</th>
                <th className="px-5 py-3.5">Present</th>
                <th className="px-5 py-3.5">Late</th>
                <th className="px-5 py-3.5">Absent</th>
                <th className="px-5 py-3.5">Percentage</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((st) => (
                <tr key={st.studentId} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">{st.rollNo}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-bold text-slate-900 block">{st.name}</span>
                    <span className="text-[10px] text-slate-400">{st.email}</span>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-slate-700">{st.className}</td>
                  <td className="px-5 py-3.5 font-mono text-slate-500">{st.totalClasses}</td>
                  <td className="px-5 py-3.5 font-mono text-emerald-600 font-bold">{st.present}</td>
                  <td className="px-5 py-3.5 font-mono text-amber-600 font-bold">{st.late}</td>
                  <td className="px-5 py-3.5 font-mono text-rose-600 font-bold">{st.absent}</td>
                  <td className="px-5 py-3.5 font-mono font-black text-sm whitespace-nowrap">
                    <span className={st.isLowAttendance ? 'text-amber-600' : 'text-emerald-600'}>
                      {st.percentage}%
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        st.isLowAttendance
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {st.isLowAttendance ? 'Low Attendance' : 'Satisfactory'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

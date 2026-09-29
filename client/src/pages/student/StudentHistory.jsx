import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  BookOpen,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  QrCode,
  ScanFace,
  UserCheck,
  MapPin,
  Search
} from 'lucide-react';
import { api } from '../../services/api';

export default function StudentHistory() {
  const [history, setHistory] = useState([]);
  const [subjectStats, setSubjectStats] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        const res = await api.get('/attendance/student-history');
        if (res.success) {
          setHistory(res.history || []);
          setSubjectStats(res.subjectStats || []);
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const filteredHistory = history.filter((item) => {
    const matchSubject = selectedSubject === 'all' || item.subject_code === selectedSubject;
    const matchStatus = selectedStatus === 'all' || item.status === selectedStatus;
    const matchSearch =
      !searchQuery ||
      item.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.faculty_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSubject && matchStatus && matchSearch;
  });

  const getMethodBadge = (method) => {
    if (method === 'qr_gps_otp') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <QrCode className="w-3 h-3 text-indigo-600" /> QR + GPS + OTP
        </span>
      );
    }
    if (method === 'face_gps_otp') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <ScanFace className="w-3 h-3 text-purple-600" /> Face + GPS + OTP
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <UserCheck className="w-3 h-3 text-amber-600" /> Faculty Override
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Attendance Records & Subject Metrics</h2>
        <p className="text-xs text-slate-500">Detailed course-wise breakdown and historical log</p>
      </div>

      {/* SUBJECT-WISE STATISTICS CARDS */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Subject Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {subjectStats.map((sub) => {
            const isLow = sub.percentage < 75.0;
            return (
              <div
                key={sub.subjectId}
                className={`p-5 rounded-2xl bg-white border transition shadow-xs ${
                  isLow ? 'border-amber-300' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {sub.subjectCode}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-1.5">{sub.subjectName}</h4>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-lg font-black ${
                        isLow ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {sub.percentage}%
                    </span>
                    <p className="text-[10px] text-slate-400 font-medium">Req: 75%</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-100 mt-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isLow ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, sub.percentage)}%` }}
                  />
                </div>

                {/* Summary numbers */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Present</p>
                    <p className="font-bold text-emerald-600">{sub.present}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Late</p>
                    <p className="font-bold text-amber-600">{sub.late}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-medium">Absent</p>
                    <p className="font-bold text-rose-600">{sub.absent}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subject or faculty..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="present">Present Only</option>
            <option value="late">Late Only</option>
          </select>
        </div>
      </div>

      {/* ATTENDANCE RECORDS TABLE */}
      <div className="rounded-3xl bg-white overflow-hidden border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5">Subject</th>
                <th className="px-5 py-3.5">Period / Faculty</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Verification Method</th>
                <th className="px-5 py-3.5">Distance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No attendance records found matching filters.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 font-medium whitespace-nowrap text-slate-900">
                      {new Date(rec.timestamp).toLocaleDateString()}
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(rec.timestamp).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-slate-900 block">{rec.subject_name}</span>
                      <span className="text-[10px] text-slate-500">{rec.subject_code}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-slate-800 font-medium block">{rec.period_name}</span>
                      <span className="text-[10px] text-slate-500">{rec.faculty_name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                          rec.status === 'present'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {rec.status === 'present' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {rec.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {getMethodBadge(rec.verification_method)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono text-[11px] text-sky-700 font-bold">
                      {rec.gps_distance_meters ? `${rec.gps_distance_meters}m away` : '15m (Quad)'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

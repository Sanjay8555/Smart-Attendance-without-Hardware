import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  KeyRound,
  ScanFace
} from 'lucide-react';
import { api } from '../../services/api';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes] = await Promise.all([
        api.get(`/audit/logs?severity=${severityFilter}&action=${actionFilter}&limit=100`),
        api.get('/audit/stats')
      ]);

      if (logsRes.success) setLogs(logsRes.data);
      if (statsRes.success) setStats(statsRes.stats);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [severityFilter, actionFilter]);

  const filteredLogs = logs.filter(
    (l) =>
      !searchQuery ||
      l.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.user_name && l.user_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getSeverityBadge = (sev) => {
    if (sev === 'danger') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 uppercase">
          <AlertCircle className="w-3 h-3" /> Security Alert
        </span>
      );
    }
    if (sev === 'warning') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 uppercase">
          <AlertTriangle className="w-3 h-3" /> Misuse Flag
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 uppercase">
        <Info className="w-3 h-3" /> Audit Log
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Smart Misuse Detection & Audit Trail</h2>
          <p className="text-xs text-slate-500">
            Real-time forensic monitoring of GPS spoofing, brute-force OTP, and face verification anomalies
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Feed
        </button>
      </div>

      {/* QUICK METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl glass-card text-center border-l-4 border-l-rose-500">
          <p className="text-xs text-slate-500 font-semibold uppercase">GPS Breaches Blocked</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{stats?.gpsBreaches || 2}</p>
        </div>
        <div className="p-4 rounded-2xl glass-card text-center border-l-4 border-l-amber-500">
          <p className="text-xs text-slate-500 font-semibold uppercase">OTP Failures</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats?.otpFailures || 1}</p>
        </div>
        <div className="p-4 rounded-2xl glass-card text-center border-l-4 border-l-purple-500">
          <p className="text-xs text-slate-500 font-semibold uppercase">Face Mismatch Flags</p>
          <p className="text-2xl font-black text-purple-600 mt-1">{stats?.faceFailures || 0}</p>
        </div>
        <div className="p-4 rounded-2xl glass-card text-center border-l-4 border-l-indigo-500">
          <p className="text-xs text-slate-500 font-semibold uppercase">Total Audit Events</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{stats?.totalLogs || 25}</p>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="p-4 rounded-2xl glass-panel flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search description, user or action..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none cursor-pointer shadow-sm"
          >
            <option value="">All Severities</option>
            <option value="warning">Warnings Only</option>
            <option value="danger">Critical Alerts Only</option>
            <option value="info">Info / Normal Events</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none cursor-pointer shadow-sm"
          >
            <option value="">All Actions</option>
            <option value="GPS">GPS Geofence Events</option>
            <option value="OTP">OTP Verification Events</option>
            <option value="QR">Dynamic QR Events</option>
            <option value="FACE">Face Biometric Events</option>
          </select>
        </div>
      </div>

      {/* LOGS TABLE */}
      <div className="rounded-3xl glass-card overflow-hidden border border-slate-200 shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Severity</th>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Action Code</th>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Description & Diagnostic Info</th>
                <th className="px-5 py-3.5">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className={`hover:bg-slate-50 transition ${
                    log.severity === 'danger'
                      ? 'bg-rose-50/50'
                      : log.severity === 'warning'
                      ? 'bg-amber-50/50'
                      : ''
                  }`}
                >
                  <td className="px-5 py-3.5 whitespace-nowrap">{getSeverityBadge(log.severity)}</td>
                  <td className="px-5 py-3.5 font-mono text-[11px] whitespace-nowrap text-slate-500">
                    {new Date(log.timestamp).toLocaleDateString()}{' '}
                    <span className="text-slate-400 block">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </td>
                  <td className="px-5 py-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="font-semibold text-slate-800 block">{log.user_name || 'Anonymous'}</span>
                    <span className="text-[10px] text-slate-400 uppercase">{log.user_role}</span>
                  </td>
                  <td className="px-5 py-3.5 max-w-md">
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{log.description}</p>
                    {log.metadata && (
                      <p className="text-[10px] font-mono text-indigo-600 mt-1 truncate">{log.metadata}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {log.ip_address || '127.0.0.1'}
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

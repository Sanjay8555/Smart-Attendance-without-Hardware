import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  ShieldCheck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileSpreadsheet,
  Sliders,
  ShieldAlert
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { api } from '../../services/api';
import StatCard from '../../components/StatCard';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AdminDashboard({ onNavigateTab }) {
  const [analytics, setAnalytics] = useState(null);
  const [summary, setSummary] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [anRes, sumRes, actRes] = await Promise.all([
          api.get('/analytics/dashboard'),
          api.get('/reports/summary'),
          api.get('/session/active')
        ]);

        if (anRes.success) setAnalytics(anRes.data);
        if (sumRes.success) setSummary(sumRes.summary);
        if (actRes.success) setActiveSessions(actRes.activeSessions || []);
      } catch (err) {
        console.error('Failed to load admin dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const trendData = {
    labels: analytics?.trend?.labels?.map(l => l.substring(5)) || ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
    datasets: [
      {
        label: 'Present Check-Ins',
        data: analytics?.trend?.present || [42, 45, 48, 50, 46],
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.08)',
        tension: 0.35,
        fill: true,
      },
      {
        label: 'Late Arrivals',
        data: analytics?.trend?.late || [4, 6, 3, 5, 2],
        borderColor: '#d97706',
        backgroundColor: 'transparent',
        tension: 0.35,
      },
      {
        label: 'Unexcused Absences',
        data: analytics?.trend?.absent || [8, 5, 4, 3, 7],
        borderColor: '#e11d48',
        backgroundColor: 'transparent',
        tension: 0.35,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#475569', font: { size: 11, weight: 'bold' } }
      },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#0f172a',
        bodyColor: '#334155',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(226, 232, 240, 0.8)' },
        ticks: { color: '#64748b', font: { size: 10, weight: '600' } }
      },
      y: {
        grid: { color: 'rgba(226, 232, 240, 0.8)' },
        ticks: { color: '#64748b', font: { size: 10, weight: '600' } }
      }
    }
  };

  const distributionData = {
    labels: ['Present', 'Late (Grace)', 'Absent'],
    datasets: [
      {
        data: [
          analytics?.distribution?.present || 120,
          analytics?.distribution?.late || 15,
          analytics?.distribution?.absent || 22
        ],
        backgroundColor: ['#059669', '#d97706', '#e11d48'],
        borderWidth: 0,
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Institutional Attendance Command Center
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                Live Admin Mode
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Apex Institute of Technology • Multi-Factor Hardware-Free Biometric Governance
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onNavigateTab('admin-biometrics')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Face & Biometrics
            </button>
            <button
              onClick={() => onNavigateTab('admin-rules')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-600" /> Configure Rules
            </button>
            <button
              onClick={() => onNavigateTab('admin-reports')}
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Full Reports
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Average Turnout"
          value={`${summary?.averagePercentage || 88.5}%`}
          subtitle="Institute-wide threshold >= 75%"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Total Students"
          value={summary?.totalStudents || 10}
          subtitle="Enrolled in departments"
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Completed Lectures"
          value={summary?.totalSessions || 15}
          subtitle="Conducted & verified"
          icon={Clock}
          color="sky"
        />
        <StatCard
          title="Security Flags"
          value={analytics?.securityAlerts?.warning || 2}
          subtitle="GPS / OTP violations intercepted"
          icon={ShieldAlert}
          color="rose"
        />
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 14-Day Attendance Trend */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                14-Day Attendance Verification Trend
              </h3>
              <p className="text-xs text-slate-500">Present vs Late vs Absent daily volume</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Daily Sync Active
            </span>
          </div>

          <div className="h-72 w-full">
            <Line data={trendData} options={chartOptions} />
          </div>
        </div>

        {/* Status Distribution Pie */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
              Overall Status Breakdown
            </h3>
            <p className="text-xs text-slate-500 mb-4">Aggregated institutional attendance</p>
            <div className="h-56 relative flex items-center justify-center">
              <Doughnut
                data={distributionData}
                options={{
                  plugins: { legend: { position: 'bottom', labels: { color: '#475569', font: { size: 10, weight: 'bold' } } } },
                  cutout: '70%'
                }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-600 font-medium">
            Attendance Method: <strong className="text-indigo-600">82% Dynamic QR</strong> • <strong className="text-purple-600">18% Face Fallback</strong>
          </div>
        </div>
      </div>

      {/* LIVE ACTIVE SESSIONS ACROSS CAMPUS */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-900">Live Attendance Sessions Running Across Campus</h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{activeSessions.length} Active Classes</span>
        </div>

        {activeSessions.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No live lectures currently running.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSessions.map((s) => (
              <div key={s.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {s.subject_code}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1">{s.subject_name}</h4>
                  <p className="text-xs text-slate-500">
                    Class: {s.class_name} • Faculty: {s.faculty_name}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-700 block">
                    {s.total_present} / {s.total_expected} Present
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">{s.location_name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

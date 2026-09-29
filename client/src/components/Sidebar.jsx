import React from 'react';
import {
  QrCode,
  ScanFace,
  BarChart3,
  CalendarCheck,
  Users,
  Building2,
  MapPin,
  ShieldAlert,
  FileSpreadsheet,
  Sliders,
  Sparkles,
  Radio,
  BookOpen,
  Camera,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ currentTab, setTab }) {
  const { isAdmin, isFaculty, isStudent } = useAuth();

  let navItems = [];

  if (isStudent) {
    navItems = [
      { id: 'student-scan', label: 'Scan for Attendance', icon: Camera, badge: 'Scan' },
      { id: 'student-active', label: 'Active Sessions', icon: QrCode, badge: 'Live' },
      { id: 'student-qr-pass', label: 'My Digital QR Pass', icon: ScanFace },
      { id: 'student-dashboard', label: 'Overview & Stats', icon: BarChart3 },
      { id: 'student-history', label: 'Attendance History', icon: CalendarCheck },
      { id: 'student-face', label: 'Face Biometrics (Opt)', icon: Sparkles },
    ];
  } else if (isFaculty) {
    navItems = [
      { id: 'faculty-dashboard', label: 'Dashboard & Classes', icon: BookOpen },
      { id: 'faculty-live', label: 'Live Attendance Room', icon: Radio, badge: 'Session' },
      { id: 'faculty-proxy', label: 'Proxy & Substitutes', icon: UserCheck, badge: 'Proxy' },
      { id: 'faculty-scanner', label: 'Staff QR Scanner', icon: Camera, badge: 'Terminal' },
      { id: 'faculty-student-qr', label: 'Student QR Generator', icon: QrCode },
      { id: 'faculty-reports', label: 'Past Sessions & History', icon: CalendarCheck },
    ];
  } else if (isAdmin) {
    navItems = [
      { id: 'admin-dashboard', label: 'System Analytics', icon: BarChart3 },
      { id: 'admin-biometrics', label: 'Face & Biometrics', icon: ScanFace, badge: 'Biometric' },
      { id: 'admin-proxy', label: 'Proxy Reassignments', icon: UserCheck },
      { id: 'admin-users', label: 'User Directory', icon: Users },
      { id: 'admin-academic', label: 'Academic Structure', icon: Building2 },
      { id: 'admin-geofences', label: 'Campus Geofences', icon: MapPin },
      { id: 'admin-rules', label: 'Attendance Rules', icon: Sliders },
      { id: 'admin-audit', label: 'Security & Misuse Logs', icon: ShieldAlert, badge: 'Audit' },
      { id: 'admin-reports', label: 'Reports & Export', icon: FileSpreadsheet },
    ];
  }

  return (
    <aside className="w-64 shrink-0 hidden md:block border-r border-slate-200 bg-white p-4 min-h-[calc(100vh-4rem)]">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-3">
        Navigation
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Zero Biometric Hardware Security Assurance Banner */}
      <div className="mt-8 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs">
        <div className="flex items-center gap-2 text-indigo-900 font-bold mb-1">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>Zero Dedicated HW</span>
        </div>
        <p className="text-slate-600 text-[11px] leading-relaxed">
          Secured with device camera liveness, dynamic QR tokens, and geofenced GPS.
        </p>
      </div>
    </aside>
  );
}

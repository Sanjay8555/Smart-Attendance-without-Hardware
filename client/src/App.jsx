import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

// Pages
import LoginPage from './pages/LoginPage';
import PublicAttendancePage from './pages/PublicAttendancePage';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentHistory from './pages/student/StudentHistory';
import StudentFaceEnroll from './pages/student/StudentFaceEnroll';
import StudentQrPassPage from './pages/student/StudentQrPassPage';
import StudentDirectScanner from './pages/student/StudentDirectScanner';

// Faculty Pages
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import FacultyLiveSession from './pages/faculty/FacultyLiveSession';
import FacultyReports from './pages/faculty/FacultyReports';
import FacultyStaffScanner from './pages/faculty/FacultyStaffScanner';
import FacultyStudentQrGenerator from './pages/faculty/FacultyStudentQrGenerator';
import FacultyProxyPage from './pages/faculty/FacultyProxyPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBiometrics from './pages/admin/AdminBiometrics';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAcademic from './pages/admin/AdminAcademic';
import AdminGeofences from './pages/admin/AdminGeofences';
import AdminRules from './pages/admin/AdminRules';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import AdminReports from './pages/admin/AdminReports';

function AppContent() {
  const { isAuthenticated, user, isAdmin, isFaculty, isStudent, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('');
  const [showPublicScanner, setShowPublicScanner] = useState(false);

  // Set default tab on role change
  useEffect(() => {
    if (isAdmin) setCurrentTab('admin-dashboard');
    else if (isFaculty) setCurrentTab('faculty-dashboard');
    else if (isStudent) setCurrentTab('student-scan');
  }, [isAdmin, isFaculty, isStudent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Loading Smart Attendance...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (showPublicScanner) {
      return <PublicAttendancePage onBackToLogin={() => setShowPublicScanner(false)} />;
    }
    return <LoginPage onOpenPublicScanner={() => setShowPublicScanner(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Body */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <Sidebar currentTab={currentTab} setTab={setCurrentTab} />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          {/* STUDENT VIEWS */}
          {isStudent && (
            <>
              {currentTab === 'student-scan' && <StudentDirectScanner />}
              {currentTab === 'student-active' && (
                <StudentDashboard
                  onNavigateScan={() => setCurrentTab('student-scan')}
                  onNavigateHistory={() => setCurrentTab('student-history')}
                  onNavigateFace={() => setCurrentTab('student-face')}
                />
              )}
              {currentTab === 'student-dashboard' && (
                <StudentDashboard
                  onNavigateScan={() => setCurrentTab('student-scan')}
                  onNavigateHistory={() => setCurrentTab('student-history')}
                  onNavigateFace={() => setCurrentTab('student-face')}
                />
              )}
              {currentTab === 'student-history' && <StudentHistory />}
              {currentTab === 'student-qr-pass' && <StudentQrPassPage />}
              {currentTab === 'student-face' && <StudentFaceEnroll />}
            </>
          )}

          {/* FACULTY VIEWS */}
          {isFaculty && (
            <>
              {currentTab === 'faculty-dashboard' && (
                <FacultyDashboard onOpenLiveRoom={() => setCurrentTab('faculty-live')} />
              )}
              {currentTab === 'faculty-live' && (
                <FacultyLiveSession onSessionClosed={() => setCurrentTab('faculty-reports')} />
              )}
              {currentTab === 'faculty-proxy' && (
                <FacultyProxyPage onLaunchSession={() => setCurrentTab('faculty-dashboard')} />
              )}
              {currentTab === 'faculty-scanner' && <FacultyStaffScanner />}
              {currentTab === 'faculty-student-qr' && <FacultyStudentQrGenerator />}
              {currentTab === 'faculty-reports' && <FacultyReports />}
            </>
          )}

          {/* ADMIN VIEWS */}
          {isAdmin && (
            <>
              {currentTab === 'admin-dashboard' && (
                <AdminDashboard onNavigateTab={(tab) => setCurrentTab(tab)} />
              )}
              {currentTab === 'admin-biometrics' && <AdminBiometrics />}
              {currentTab === 'admin-proxy' && <FacultyProxyPage />}
              {currentTab === 'admin-users' && <AdminUsers />}
              {currentTab === 'admin-academic' && <AdminAcademic />}
              {currentTab === 'admin-geofences' && <AdminGeofences />}
              {currentTab === 'admin-rules' && <AdminRules />}
              {currentTab === 'admin-audit' && <AdminAuditLogs />}
              {currentTab === 'admin-reports' && <AdminReports />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

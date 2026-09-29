import React, { useState } from 'react';
import { Radio, Lock, Mail, ArrowRight, ShieldCheck, Sparkles, User, Layers, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export default function LoginPage({ onOpenPublicScanner }) {
  const { login } = useAuth();
  const { showToast } = useNotification();
  const [email, setEmail] = useState('admin@college.edu');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please enter both email and password.', 'warning');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      showToast('Welcome back! Signed in successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setLoading(true);
    try {
      await login(demoEmail, demoPass);
      showToast(`Signed in successfully!`, 'success');
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden bg-slate-50">
      {/* Background Subtle Decorative Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-sky-100/60 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 px-4">
        <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-500 shadow-lg shadow-indigo-500/20 mb-3">
          <Radio className="w-8 h-8 text-white animate-pulse" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
          Smart Attendance System
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
          Hardware-Free Biometric Verification & Multi-Factor Authentication
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 space-y-4">
        
        {/* PUBLIC ZERO-LOGIN QR & FACE SCANNER BUTTON */}
        <div className="p-4 rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 text-white shadow-xl shadow-indigo-600/20 border border-indigo-400/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white inline-block mb-1">
              Zero Login Required
            </span>
            <h4 className="text-sm font-black">Student Attendance Terminal</h4>
            <p className="text-[11px] text-indigo-100 mt-0.5">
              Scan Classroom QR & verify face biometrics directly
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPublicScanner}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>Scan QR Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* STAFF & ADMIN LOGIN FORM */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200">
          <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Staff / Student Sign In</h3>
            <span className="text-[10px] text-slate-400 font-semibold">Institutional Access</span>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@college.edu"
                  className="w-full text-xs font-medium pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs font-medium pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                'Authenticating...'
              ) : (
                <>
                  Sign In to Portal <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Fast 1-Click Login */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Fast 1-Click Login:
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Instant Access</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('admin@college.edu', 'Admin@123')}
                className="p-2.5 rounded-2xl text-center bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 transition cursor-pointer shadow-xs hover:shadow-sm"
              >
                <Shield className="w-4 h-4 mx-auto mb-1 text-rose-600" />
                <strong className="text-xs font-bold block">Admin</strong>
                <span className="text-[9px] text-rose-600 block mt-0.5 font-medium">Full Access</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('faculty.sharma@college.edu', 'Faculty@123')}
                className="p-2.5 rounded-2xl text-center bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 transition cursor-pointer shadow-xs hover:shadow-sm"
              >
                <Layers className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                <strong className="text-xs font-bold block">Faculty</strong>
                <span className="text-[9px] text-indigo-600 block mt-0.5 font-medium">Prof. Sharma</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('alex@college.edu', 'Student@123')}
                className="p-2.5 rounded-2xl text-center bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 transition cursor-pointer shadow-xs hover:shadow-sm"
              >
                <User className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                <strong className="text-xs font-bold block">Student</strong>
                <span className="text-[9px] text-emerald-600 block mt-0.5 font-medium">Alex Johnson</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>AES/Bcrypt Encrypted • Dynamic Rotating QR • Geofence Protection</span>
        </div>
      </div>
    </div>
  );
}

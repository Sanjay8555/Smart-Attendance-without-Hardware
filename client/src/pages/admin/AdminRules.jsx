import React, { useState, useEffect } from 'react';
import { Sliders, Save, RotateCcw, ShieldCheck, Clock, QrCode, KeyRound, MapPin, ScanFace } from 'lucide-react';
import { api } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

export default function AdminRules() {
  const { showToast } = useNotification();
  const [settings, setSettings] = useState({
    session_duration_minutes: '50',
    qr_expiration_seconds: '15',
    otp_expiration_seconds: '600',
    late_entry_minutes: '15',
    gps_radius_meters: '150',
    max_otp_attempts: '5',
    max_face_attempts: '3',
    min_attendance_percentage: '75',
    face_verification_enabled: 'true',
    liveness_check_required: 'true'
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings');
      if (res.success && res.settings) {
        setSettings(prev => ({ ...prev, ...res.settings }));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.put('/settings', settings);
      if (res.success) {
        showToast('System attendance rules & security policies updated!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to update settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset all security rules and thresholds to system factory defaults?')) return;
    try {
      const res = await api.post('/settings/reset-defaults');
      if (res.success) {
        showToast('Settings restored to defaults.', 'info');
        loadSettings();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Attendance Rules & Security Policies</h2>
          <p className="text-xs text-slate-500">Configure multi-factor expiration thresholds and anti-tampering parameters</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> {isSaving ? 'Saving...' : 'Save Rules'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: DYNAMIC TIMING & EXPIRATIONS */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-indigo-700 font-bold text-sm">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Session Timers & Expirations</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Dynamic QR Rotation Interval (Seconds)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={settings.qr_expiration_seconds}
                onChange={(e) => handleChange('qr_expiration_seconds', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Default 15s. Prevents sharing screenshots of QR codes among students.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                OTP Session Expiry (Seconds)
              </label>
              <input
                type="number"
                min="60"
                max="3600"
                value={settings.otp_expiration_seconds}
                onChange={(e) => handleChange('otp_expiration_seconds', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Default 600s (10 mins). Session OTP validity window.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Late Entry Grace Period (Minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.late_entry_minutes}
                onChange={(e) => handleChange('late_entry_minutes', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Arrivals within 0–15 mins marked Present; 15–30 mins marked Late.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Default Session Duration (Minutes)
              </label>
              <input
                type="number"
                min="15"
                max="180"
                value={settings.session_duration_minutes}
                onChange={(e) => handleChange('session_duration_minutes', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Default lecture period duration.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: SECURITY & ATTEMPT LIMITS */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-purple-700 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span>Anti-Brute Force & Attempt Limits</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Max OTP Verification Attempts
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.max_otp_attempts}
                onChange={(e) => handleChange('max_otp_attempts', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Locks out brute-force attempts after N consecutive failures.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Minimum Attendance Requirement (%)
              </label>
              <input
                type="number"
                min="50"
                max="100"
                value={settings.min_attendance_percentage}
                onChange={(e) => handleChange('min_attendance_percentage', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Institutional threshold for exam eligibility (Default 75%).
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3: BIOMETRICS & LIVENESS POLICIES */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-emerald-700 font-bold text-sm">
            <ScanFace className="w-4 h-4 text-emerald-600" />
            <span>Camera Face Biometric & Liveness Switches</span>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">Enable Camera Face Fallback System-Wide</p>
                <p className="text-[11px] text-slate-500">
                  Allows faculty to offer camera-based face verification when QR codes cannot be scanned.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.face_verification_enabled === 'true'}
                onChange={(e) => handleChange('face_verification_enabled', e.target.checked ? 'true' : 'false')}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">Enforce Multi-Frame Liveness Challenge</p>
                <p className="text-[11px] text-slate-500">
                  Demands eye-blink and head-pose verification to neutralize still photograph replay attacks.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.liveness_check_required === 'true'}
                onChange={(e) => handleChange('liveness_check_required', e.target.checked ? 'true' : 'false')}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </form>
    </div>
  );
}

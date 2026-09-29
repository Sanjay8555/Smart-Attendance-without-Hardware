import React, { useState, useEffect } from 'react';
import {
  ScanFace,
  Shield,
  CheckCircle2,
  Lock,
  Camera,
  Trash2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  RotateCcw
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import FaceEnrollmentModal from '../../components/FaceEnrollmentModal';

export default function StudentFaceEnroll() {
  const { student, user, refreshProfile } = useAuth();
  const { showToast } = useNotification();
  const [faceStatus, setFaceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/face/status');
      if (res.success) {
        setFaceStatus(res);
      }
    } catch (err) {
      console.error('Failed to load face status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRevoke = async () => {
    if (!window.confirm('Are you sure you want to permanently delete your enrolled face biometric template?')) {
      return;
    }
    try {
      const res = await api.delete('/face/revoke');
      if (res.success) {
        showToast('Face biometric template deleted.', 'info');
        fetchStatus();
        refreshProfile();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete template', 'error');
    }
  };

  const isEnrolled = faceStatus?.isEnrolled;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Camera Face Biometrics & Privacy</h2>
          <p className="text-xs text-slate-500">
            Optional Fallback Attendance Method • Zero Dedicated Hardware Required
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition cursor-pointer"
          title="Refresh Biometric Status"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* STATUS CARD */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                isEnrolled
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-purple-50 text-purple-600 border border-purple-200'
              }`}
            >
              <ScanFace className="w-8 h-8" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {isEnrolled ? 'Face Enrollment Active' : 'Face Verification Not Enrolled'}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isEnrolled
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isEnrolled ? 'Active' : 'Optional'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isEnrolled
                  ? 'Your biometric template is stored as a 128-dim encrypted vector for classroom attendance.'
                  : 'You can mark attendance with QR codes, or enroll your face for quick camera-based fallback.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isEnrolled ? (
              <>
                <button
                  onClick={() => setIsEnrollModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-600" /> Re-calibrate Face
                </button>
                <button
                  onClick={handleRevoke}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Revoke Consent
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEnrollModalOpen(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Camera className="w-4 h-4" /> Enroll Face Now
              </button>
            )}
          </div>
        </div>

        {isEnrolled && faceStatus.templateInfo && (
          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-slate-500">Enrolled On:</p>
              <p className="font-bold text-slate-800">
                {new Date(faceStatus.templateInfo.enrolledAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Liveness Calibration Score:</p>
              <p className="font-bold text-emerald-600">
                {((faceStatus.templateInfo.livenessConfidence || 0.98) * 100).toFixed(0)}% High Confidence
              </p>
            </div>
            <div>
              <p className="text-slate-500">Template Format:</p>
              <p className="font-bold text-indigo-700 font-mono">
                128-d Vector (Zero Photos)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* BIOMETRIC PRIVACY & LEGAL SAFEGUARDS NOTICE */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
          <Shield className="w-5 h-5 text-indigo-600" />
          <span>Biometric Privacy & Legal Compliance Framework</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-1">1. Mathematical Vector Extraction</h4>
            <p className="text-slate-600 leading-relaxed">
              The camera client generates irreversible numerical facial landmark embeddings. Raw photographs and video feeds are never saved, transmitted, or stored on any server.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-1">2. Anti-Spoofing Liveness Checks</h4>
            <p className="text-slate-600 leading-relaxed">
              Verification requires real-time eye blinks and slight multi-angle head movement to prevent photo or recorded video replay spoofing attempts.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-1">3. Non-Exclusive & Voluntary</h4>
            <p className="text-slate-600 leading-relaxed">
              Face verification is strictly an optional fallback mechanism. Students can always mark attendance using the primary Dynamic QR Code method without biometric enrollment.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-1">4. Permanent Purge Control</h4>
            <p className="text-slate-600 leading-relaxed">
              Under Institutional Data Governance, students maintain full sovereignty over their biometric records and can permanently delete their enrolled template at any moment.
            </p>
          </div>
        </div>
      </div>

      {/* ENROLLMENT MODAL */}
      <FaceEnrollmentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        onEnrolled={() => {
          fetchStatus();
          refreshProfile();
        }}
        isAlreadyEnrolled={isEnrolled}
      />
    </div>
  );
}

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Award, Clock, MapPin, ShieldCheck, X } from 'lucide-react';
import { sound } from '../services/sound';

export default function AttendanceSuccessModal({ isOpen, result, onClose }) {
  useEffect(() => {
    if (isOpen && result) {
      sound.playSuccess();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}
    }
  }, [isOpen, result]);

  if (!isOpen || !result) return null;

  const isPresent = result.status === 'present';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-white border border-emerald-200 p-6 sm:p-8 shadow-2xl text-center overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success Animated Badge */}
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-sm shadow-emerald-500/20">
          <CheckCircle2 className="w-10 h-10 animate-bounce" />
        </div>

        <h2 className="text-xl font-black text-slate-900">Attendance Verified!</h2>
        <p className="text-xs text-slate-600 mt-1">{result.message}</p>

        {/* Status Pill */}
        <div className="my-4">
          <span
            className={`inline-block px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              isPresent
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            Status: {result.status}
          </span>
        </div>

        {/* Verification Certificate Receipt */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2.5 text-xs text-slate-700 shadow-inner">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-slate-500 font-medium">Subject:</span>
            <span className="font-bold text-slate-900">{result.subjectName || 'Database Management Systems'}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600" /> Timestamp:
            </span>
            <span className="font-mono text-slate-800 font-bold">
              {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Method:
            </span>
            <span className="font-mono text-emerald-700 uppercase font-bold">
              {result.verificationMethod}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-sky-600" /> Geofence Distance:
            </span>
            <span className="font-mono text-sky-700 font-bold">
              {result.distanceMeters || 15}m from Quad
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md shadow-emerald-600/20 cursor-pointer"
        >
          Done & Return to Dashboard
        </button>
      </div>
    </div>
  );
}

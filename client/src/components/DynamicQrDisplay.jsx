import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { RefreshCw, KeyRound, Clock, ShieldCheck, Copy, Check, Users } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

export default function DynamicQrDisplay({
  session,
  onRotateQr,
  onRegenerateOtp,
  timeRemainingSeconds = 1800,
  presentCount = 0,
  expectedCount = 60
}) {
  const { showToast } = useNotification();
  const [copied, setCopied] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(15);

  useEffect(() => {
    const timer = setInterval(() => {
      setQrCountdown((prev) => (prev > 1 ? prev - 1 : 15));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyToken = () => {
    if (session?.current_qr_token) {
      navigator.clipboard.writeText(session.current_qr_token);
      setCopied(true);
      showToast('Dynamic QR Token copied to clipboard!', 'info');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 text-center relative overflow-hidden shadow-sm">
      {/* Background subtle glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-50/60 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner & Status */}
      <div className="w-full flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 pl-3">
            Live Dynamic QR
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-4 h-4 text-indigo-600" />
          <span>Session Remaining: <strong className="text-slate-900 font-mono">{formatTime(timeRemainingSeconds)}</strong></span>
        </div>
      </div>

      {/* Dynamic QR Code Canvas with Rotating Countdown */}
      <div className="relative p-4 rounded-3xl bg-white border-2 border-slate-200 shadow-md pulse-qr flex items-center justify-center">
        {session?.id ? (
          <QRCodeCanvas
            value={JSON.stringify({
              sessionId: session.id,
              token: session.current_qr_token || session.id,
              subject: session.subject_name
            })}
            size={220}
            level="M"
            includeMargin={true}
          />
        ) : (
          <div className="w-[220px] h-[220px] flex items-center justify-center text-slate-400 text-xs">
            Loading QR...
          </div>
        )}

        {/* Floating Rotation Badge */}
        <div className="absolute -bottom-3 px-3 py-1 rounded-full bg-slate-900 text-white text-[11px] font-bold shadow-md flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
          <span>Rotates in: <span className="font-mono text-amber-300">{qrCountdown}s</span></span>
        </div>
      </div>

      {/* OTP Display Card */}
      <div className="mt-8 w-full max-w-sm p-4 rounded-2xl bg-amber-50/60 border border-amber-200 shadow-xs">
        <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
          <span className="flex items-center gap-1.5 font-bold text-amber-900">
            <KeyRound className="w-3.5 h-3.5 text-amber-600" /> Session OTP
          </span>
          <button
            onClick={onRegenerateOtp}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer transition"
          >
            <RefreshCw className="w-3 h-3" /> New OTP
          </button>
        </div>

        <div className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-amber-700 bg-white py-2.5 rounded-xl border border-amber-200 shadow-xs">
          {session?.current_otp_display || '------'}
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5 font-medium">Students must enter this 6-digit OTP after QR / Face check</p>
      </div>

      {/* Action Buttons & Manual Token Helper */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
        <button
          onClick={onRotateQr}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Rotate QR Now
        </button>

        <button
          onClick={handleCopyToken}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
          title="Copy token string for easy test paste"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
          <span>{copied ? 'Copied Token!' : 'Copy Token String'}</span>
        </button>
      </div>

      {/* Real-time Attendees Progress bar */}
      <div className="w-full mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-600 font-medium">
          <Users className="w-4 h-4 text-indigo-600" />
          <span>Present: <strong className="text-emerald-600 font-bold">{presentCount}</strong> / {expectedCount}</span>
        </div>
        <div className="text-slate-600 font-medium">
          Turnout: <strong className="text-slate-900 font-bold">{expectedCount > 0 ? Math.round((presentCount / expectedCount) * 100) : 0}%</strong>
        </div>
      </div>
    </div>
  );
}

import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, X, Sparkles, Calendar, Clock, BookOpen, GraduationCap, Maximize2 } from 'lucide-react';

export default function PrintQrPosterModal({ isOpen, session, onClose }) {
  const posterRef = useRef(null);

  if (!isOpen || !session) return null;

  const sessionDate = session.start_time ? new Date(session.start_time).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : new Date().toLocaleDateString();

  const sessionTime = session.start_time ? `${new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Live Session';

  // Lightweight compact QR Payload for instant camera recognition
  const qrPayload = JSON.stringify({
    sessionId: session.id,
    token: session.current_qr_token || session.id,
    subject: session.subject_name
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6">
        
        {/* Modal Header & Controls (Hidden when printing) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 print:hidden">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
              Classroom Attendance Display
            </span>
            <h3 className="text-lg font-bold text-slate-900">Printable QR Code Poster</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print Poster (Ctrl+P)
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE POSTER CONTAINER */}
        <div
          ref={posterRef}
          className="p-8 rounded-3xl border-2 border-slate-800 text-center bg-white space-y-6 shadow-sm print:border-none print:p-0 print:m-0"
        >
          {/* Institutional Header */}
          <div className="border-b-2 border-slate-800 pb-4">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
              Apex Institute of Technology
            </h1>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mt-0.5">
              Smart Attendance Management System • Zero Dedicated Hardware
            </p>
          </div>

          {/* Session Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Class / Dept</span>
                <span className="font-bold text-slate-900">{session.class_name || 'CSE - Section A'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Subject</span>
                <span className="font-bold text-slate-900">{session.subject_name} ({session.subject_code})</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Date</span>
                <span className="font-semibold text-slate-800">{sessionDate}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Time Window</span>
                <span className="font-semibold text-slate-800">{sessionTime}</span>
              </div>
            </div>
          </div>

          {/* HIGH-RESOLUTION QR CODE CANVAS */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="p-4 rounded-3xl bg-white border-2 border-slate-900 shadow-md">
              <QRCodeCanvas
                value={qrPayload}
                size={260}
                level="M"
                includeMargin={true}
              />
            </div>
            <p className="text-[11px] font-mono text-slate-500 mt-2">
              Session ID: <strong className="text-slate-800">{session.id}</strong>
            </p>
          </div>

          {/* 3-STEP STUDENT INSTRUCTIONS */}
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-2">
              Instructions for Students:
            </h4>
            <ol className="text-xs text-indigo-950 space-y-1.5 list-decimal list-inside font-medium">
              <li><strong>Step 1:</strong> Open student portal on smartphone/laptop and tap <strong>"Scan QR"</strong>.</li>
              <li><strong>Step 2:</strong> Device camera opens automatically for <strong>Face Recognition</strong>.</li>
              <li><strong>Step 3:</strong> Once verified (MATCH), attendance is recorded as <strong>PRESENT</strong> in database.</li>
            </ol>
          </div>

          {/* Footer Warning */}
          <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-3">
            Anti-spoofing enabled • Face recognition biometric match required • Unauthorized sharing strictly audited
          </div>
        </div>

      </div>
    </div>
  );
}

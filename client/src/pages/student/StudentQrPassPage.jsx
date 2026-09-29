import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Printer, Download, Sparkles, GraduationCap, Building2, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

export default function StudentQrPassPage() {
  const { student, user } = useAuth();
  const { showToast } = useNotification();
  const cardRef = useRef(null);

  const studentName = student?.name || user?.name || 'Student';
  const rollNo = student?.roll_no || '22CS01';
  const className = student?.class_name || 'CSE - Section A';
  const departmentName = student?.department_name || 'Computer Science & Engineering';
  const studentId = student?.student_id || student?.id || 'STU-2024-001';

  const qrPayload = JSON.stringify({
    type: 'STUDENT_ID_CARD',
    studentId: student?.id || studentId,
    studentCode: studentId,
    rollNo: rollNo,
    name: studentName,
    className: className,
    department: departmentName
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const canvas = document.getElementById('student-digital-pass-canvas');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `Student_QR_${rollNo}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    showToast('Student Digital QR Pass downloaded as PNG image.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">My Digital Student QR Pass</h2>
              <p className="text-xs text-slate-500">
                Official institutional ID card and contactless attendance QR pass
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" /> Save PNG
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Print ID Pass
          </button>
        </div>
      </div>

      {/* Main Student Pass Card */}
      <div className="flex flex-col items-center justify-center p-4">
        <div
          ref={cardRef}
          className="w-full max-w-md p-8 rounded-3xl bg-white border-2 border-slate-800 shadow-xl text-center space-y-5 print:shadow-none print:border-2 print:border-slate-800"
        >
          {/* Institutional Header */}
          <div className="border-b-2 border-slate-800 pb-3">
            <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide">
              Apex Institute of Technology
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
              Smart Attendance System • Digital Identity Pass
            </p>
          </div>

          {/* Student Avatar & Identity */}
          <div className="space-y-1">
            <div className="w-20 h-20 rounded-full bg-indigo-600 text-white font-black text-2xl flex items-center justify-center mx-auto shadow-md ring-4 ring-indigo-50">
              {studentName.charAt(0)}
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-3">{studentName}</h2>
            <div className="inline-block px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Roll No: {rollNo}
            </div>
            <p className="text-xs text-slate-600 font-medium mt-1">{departmentName}</p>
            <p className="text-xs font-semibold text-slate-700">Class: {className}</p>
          </div>

          {/* High-Resolution QR Canvas */}
          <div className="p-4 bg-white rounded-3xl border-2 border-slate-900 shadow-md inline-block">
            <QRCodeCanvas
              id="student-digital-pass-canvas"
              value={qrPayload}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Anti-spoofing Notice */}
          <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs text-slate-600 text-left space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-indigo-900 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Contactless Classroom Verification</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Show this QR pass to your staff scanner or scan the classroom dynamic QR from your device to record attendance.
            </p>
          </div>

          <div className="text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-3">
            Institutional Student ID: <strong className="text-slate-700">{studentId}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

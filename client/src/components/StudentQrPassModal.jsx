import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, X, Sparkles, GraduationCap, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function StudentQrPassModal({ isOpen, onClose }) {
  const { student, user } = useAuth();

  if (!isOpen || !student) return null;

  const qrPayload = JSON.stringify({
    type: 'STUDENT_ID_CARD',
    studentId: student.id,
    studentCode: student.student_id,
    rollNo: student.roll_no,
    name: student.name || user?.name,
    className: student.class_name,
    department: student.department_name
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-5 text-center">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
            Digital Identity Pass
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* College Header */}
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase">Apex Institute of Technology</h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Student Attendance Pass</p>
        </div>

        {/* Student Avatar & Meta */}
        <div className="space-y-1">
          <div className="w-16 h-16 rounded-full bg-indigo-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-sm ring-4 ring-indigo-50">
            {user?.name?.charAt(0) || 'S'}
          </div>
          <h4 className="text-base font-black text-slate-900 mt-2">{user?.name}</h4>
          <p className="text-xs font-mono font-bold text-indigo-700">Roll No: {student.roll_no}</p>
          <p className="text-[11px] text-slate-600">{student.department_name} • {student.class_name}</p>
        </div>

        {/* Bright QR Code for Staff Scanner */}
        <div className="p-3 bg-white rounded-2xl border-2 border-slate-900 shadow-md inline-block">
          <QRCodeCanvas
            value={qrPayload}
            size={180}
            level="H"
            includeMargin={true}
          />
        </div>

        <p className="text-[11px] text-slate-500 font-medium">
          Show this QR code to staff camera scanner at the classroom entrance.
        </p>
      </div>
    </div>
  );
}

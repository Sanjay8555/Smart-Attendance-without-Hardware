import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  QrCode,
  Printer,
  Download,
  Search,
  Filter,
  Users,
  GraduationCap,
  Building2,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Eye,
  FileText
} from 'lucide-react';
import { api } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

export default function FacultyStudentQrGenerator() {
  const { showToast } = useNotification();
  const [students, setStudents] = useState([]);
  const [academicStructure, setAcademicStructure] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBatchPrintMode, setIsBatchPrintMode] = useState(false);

  const idBadgeRef = useRef(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stuRes, structRes] = await Promise.all([
        api.get('/users/students'),
        api.get('/academic/structure')
      ]);

      if (stuRes.success) {
        setStudents(stuRes.data || []);
        if (stuRes.data && stuRes.data.length > 0) {
          setSelectedStudent(stuRes.data[0]);
        }
      }

      if (structRes.success) {
        setAcademicStructure(structRes.data);
      }
    } catch (err) {
      console.error('Failed to load student QR directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredStudents = students.filter((s) => {
    const matchClass = !selectedClass || s.class_id === selectedClass || s.class_name === selectedClass;
    const matchSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.roll_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchClass && matchSearch;
  });

  const getStudentQrPayload = (student) => {
    if (!student) return '';
    return JSON.stringify({
      type: 'STUDENT_ID_CARD',
      studentId: student.id || student.student_id,
      studentCode: student.student_id,
      rollNo: student.roll_no,
      name: student.name,
      className: student.class_name,
      department: student.department_name
    });
  };

  const handlePrintSingle = () => {
    setIsBatchPrintMode(false);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePrintBatch = () => {
    setIsBatchPrintMode(true);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadQr = () => {
    const canvas = document.getElementById('student-qr-canvas-preview');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `Student_QR_${selectedStudent?.roll_no || 'Pass'}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    showToast('Student QR Code downloaded as PNG image.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Student QR Code Generator & ID Badge Manager</h2>
              <p className="text-xs text-slate-500">
                Generate, download, and print individual or batch student QR cards for attendance
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintBatch}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" /> Batch Print Class Roster ({filteredStudents.length})
          </button>
        </div>
      </div>

      {/* Main Grid: Left = Student List & Selector, Right = Selected Student QR Badge Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        
        {/* LEFT COLUMN: Filter & Student Directory */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
            
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, roll no..."
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="">All Classes</option>
                {academicStructure?.classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Students Table */}
            <div className="max-h-[460px] overflow-y-auto space-y-1.5">
              {filteredStudents.map((st) => {
                const isSelected = selectedStudent?.id === st.id;
                return (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStudent(st)}
                    className={`p-3 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-300 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                        {st.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">{st.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Roll: {st.roll_no} • {st.class_name}</span>
                      </div>
                    </div>

                    <button className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-white border border-slate-200 text-indigo-700 shadow-2xs">
                      View QR
                    </button>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Real-time Student QR Card Generator */}
        <div className="lg:col-span-6 space-y-4">
          {selectedStudent ? (
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-600 block">Personal Identity Badge</span>
                  <h3 className="text-base font-bold text-slate-900">Student QR Pass</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadQr}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" /> Save PNG
                  </button>
                  <button
                    onClick={handlePrintSingle}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Badge
                  </button>
                </div>
              </div>

              {/* CARD PREVIEW CONTAINER */}
              <div
                ref={idBadgeRef}
                className="max-w-sm mx-auto p-6 rounded-3xl bg-gradient-to-b from-slate-50 to-white border-2 border-slate-800 shadow-md text-center space-y-4"
              >
                {/* College Header */}
                <div className="border-b-2 border-slate-800 pb-2">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    Apex Institute of Technology
                  </h4>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Digital Student Attendance Pass
                  </p>
                </div>

                {/* Student Avatar & Basic Info */}
                <div>
                  <div className="w-16 h-16 rounded-full bg-indigo-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-sm ring-4 ring-indigo-50">
                    {selectedStudent.name.charAt(0)}
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-2">{selectedStudent.name}</h3>
                  <p className="text-xs font-mono font-bold text-indigo-700">Roll No: {selectedStudent.roll_no}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{selectedStudent.department_name} • {selectedStudent.class_name}</p>
                </div>

                {/* QR Code Canvas */}
                <div className="p-3 bg-white rounded-2xl border-2 border-slate-900 shadow-xs inline-block">
                  <QRCodeCanvas
                    id="student-qr-canvas-preview"
                    value={getStudentQrPayload(selectedStudent)}
                    size={160}
                    level="H"
                    includeMargin={true}
                  />
                </div>

                <div className="text-[9px] font-mono text-slate-400 border-t border-slate-100 pt-2">
                  ID: {selectedStudent.student_id || selectedStudent.id}
                </div>
              </div>

            </div>
          ) : (
            <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center text-xs text-slate-400">
              Select a student to generate their personal QR identity badge.
            </div>
          )}
        </div>

      </div>

      {/* ======================================================== */}
      {/* PRINT-ONLY MULTI-CARD BATCH LAYOUT                       */}
      {/* ======================================================== */}
      <div className="hidden print:block space-y-6">
        <div className="text-center pb-4 border-b-2 border-slate-800">
          <h1 className="text-2xl font-black text-slate-900 uppercase">Apex Institute of Technology</h1>
          <p className="text-xs font-bold text-slate-600 uppercase">Official Student Attendance QR Badges Roster</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {(isBatchPrintMode ? filteredStudents : [selectedStudent]).filter(Boolean).map((st) => (
            <div
              key={st.id}
              className="p-4 rounded-2xl border-2 border-slate-800 text-center space-y-2 page-break-inside-avoid bg-white"
            >
              <div className="border-b border-slate-800 pb-1">
                <p className="text-[10px] font-black uppercase text-slate-900">Apex Institute of Technology</p>
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">{st.name}</h4>
                <p className="text-[10px] font-mono font-bold text-indigo-700">Roll: {st.roll_no} • {st.class_name}</p>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-800 inline-block">
                <QRCodeCanvas
                  value={getStudentQrPayload(st)}
                  size={120}
                  level="H"
                  includeMargin={true}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

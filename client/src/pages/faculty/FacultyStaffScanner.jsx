import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Users,
  Sparkles,
  RefreshCw,
  Search,
  Radio,
  Clock,
  ShieldCheck,
  UserCheck,
  Upload
} from 'lucide-react';
import { api } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { sound } from '../../services/sound';
import { decodeQrFromImageFile } from '../../services/qrDecoder';

export default function FacultyStaffScanner() {
  const { showToast } = useNotification();
  const [activeSession, setActiveSession] = useState(null);
  const [studentsList, setStudentsList] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [recentScans, setRecentScans] = useState([]);
  const [lastScannedResult, setLastScannedResult] = useState(null);
  const [manualRollInput, setManualRollInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    showToast('Decoding QR code from uploaded image...', 'info');

    try {
      const decodedText = await decodeQrFromImageFile(file);
      sound.playBeep();
      showToast('✓ Student QR code detected!', 'success');
      handleProcessScannedQr(decodedText);
    } catch (err) {
      sound.playError();
      showToast(err.message || 'Could not detect QR code in this image.', 'error');
    }
  };

  const loadActiveSessionAndStudents = async () => {
    try {
      setLoading(true);
      const [sessRes, stuRes] = await Promise.all([
        api.get('/session/active'),
        api.get('/users/students')
      ]);

      if (sessRes.success && sessRes.session) {
        setActiveSession(sessRes.session);
      } else {
        setActiveSession(null);
      }

      if (stuRes.success) {
        setStudentsList(stuRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load session/students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveSessionAndStudents();
  }, []);

  // Initialize HTML5 QR Scanner
  const startScanner = async () => {
    setIsCameraActive(true);
    setCameraError('');

    setTimeout(async () => {
      try {
        const regionId = 'staff-qr-reader-region';
        const element = document.getElementById(regionId);
        if (!element) return;

        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
          } catch (e) {}
        }

        const html5QrCode = new Html5Qrcode(regionId);
        scannerRef.current = html5QrCode;

        let cameraConfig = { facingMode: 'user' };
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const validCameras = cameras.filter((d) => {
              const l = (d.label || '').toLowerCase();
              return !l.includes('ir') && !l.includes('infrared');
            });
            const chosen = validCameras.length > 0 ? validCameras[0] : cameras[0];
            cameraConfig = chosen.id;
          }
        } catch (e) {
          cameraConfig = { facingMode: 'user' };
        }

        await html5QrCode.start(
          cameraConfig,
          { fps: 15, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            handleProcessScannedQr(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.warn('Camera environment mode error, falling back to user webcam:', err);
        try {
          const regionId = 'staff-qr-reader-region';
          const html5QrCode = new Html5Qrcode(regionId);
          scannerRef.current = html5QrCode;
          await html5QrCode.start(
            { facingMode: 'user' },
            { fps: 15, qrbox: { width: 240, height: 240 } },
            (decodedText) => {
              handleProcessScannedQr(decodedText);
            },
            () => {}
          );
        } catch (err2) {
          console.error('All camera start attempts failed:', err2);
          setCameraError(err2.message || 'Camera permission denied or no camera device found. Use the quick roll lookup below.');
        }
      }
    }, 150);
  };

  const stopCamera = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().catch(() => {});
      } catch (e) {}
    }
    setIsCameraActive(false);
  };

  const handleProcessScannedQr = async (qrDataString) => {
    if (isSubmitting || !activeSession) return;
    setIsSubmitting(true);

    try {
      sound.playBeep();
      const res = await api.post('/attendance/staff-scan', {
        session_id: activeSession.id,
        student_qr_data: qrDataString
      });

      if (res.success) {
        sound.playSuccess();
        const scanItem = {
          id: Date.now(),
          name: res.student.name,
          rollNo: res.student.roll_no,
          className: res.student.class_name,
          status: res.status || 'present',
          alreadyMarked: !!res.alreadyMarked,
          time: new Date().toLocaleTimeString(),
          message: res.message
        };

        setLastScannedResult(scanItem);
        setRecentScans((prev) => [scanItem, ...prev.slice(0, 9)]);
        showToast(res.message, res.alreadyMarked ? 'info' : 'success');
      }
    } catch (err) {
      sound.playError();
      const errItem = {
        id: Date.now(),
        name: 'Unrecognized Student / QR',
        rollNo: 'Invalid',
        status: 'error',
        time: new Date().toLocaleTimeString(),
        message: err.message || 'QR Scan verification failed'
      };
      setLastScannedResult(errItem);
      showToast(err.message || 'Scan verification failed', 'error');
    } finally {
      // Small cooldown to prevent duplicate reads in the same second
      setTimeout(() => setIsSubmitting(false), 1200);
    }
  };

  const handleManualScan = (rollNoOrId) => {
    if (!rollNoOrId || !activeSession) return;
    handleProcessScannedQr(rollNoOrId);
    setManualRollInput('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Staff Attendance QR Scanner</h2>
              <p className="text-xs text-slate-500">
                Scan student ID badges with staff camera for rapid classroom entry verification
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadActiveSessionAndStudents}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Session
        </button>
      </div>

      {/* ACTIVE SESSION STATUS */}
      {!activeSession ? (
        <div className="p-10 rounded-3xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
          <Radio className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No Active Attendance Session</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Please start an attendance session from your Faculty Dashboard first before launching the staff scanner.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: Live Camera Scanner */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              
              {/* Session Meta */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-700 block">Current Class Session</span>
                  <h4 className="text-sm font-bold text-slate-900">{activeSession.subject_name} ({activeSession.class_name})</h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Live
                </span>
              </div>

              {/* Camera Scanner Viewport */}
              {isCameraActive ? (
                <div className="relative w-full rounded-2xl overflow-hidden border-2 border-indigo-500 bg-black aspect-square max-w-[320px] mx-auto flex items-center justify-center shadow-lg">
                  <div id="staff-qr-reader-region" className="w-full h-full" />
                  <div className="scanner-laser" />
                  <div className="absolute top-3 inset-x-3 py-1 px-3 rounded-full bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-white text-center">
                    Point camera at Student ID QR Card
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-3">
                  <QrCode className="w-12 h-12 text-indigo-500 mx-auto" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Staff Camera Scanner Terminal</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Fast continuous scanner for queue / door entry verification
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={startScanner}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
                    >
                      <Camera className="w-4 h-4 inline mr-1.5" /> Start Staff Scanner Camera
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-600" />
                      <span>Upload Student QR Image</span>
                    </button>
                  </div>

                  {cameraError && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-left">
                      <strong>Camera Notice:</strong> {cameraError}
                    </div>
                  )}
                </div>
              )}

              {isCameraActive && (
                <button
                  onClick={stopCamera}
                  className="w-full py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                >
                  Stop Scanner Camera
                </button>
              )}

              {/* Fast Manual Roll Scanner */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-bold text-slate-700">Quick Student Scan / Roll Lookup:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualRollInput}
                    onChange={(e) => setManualRollInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualScan(manualRollInput)}
                    placeholder="Enter Student Roll No (e.g. 22CS01)..."
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <button
                    onClick={() => handleManualScan(manualRollInput)}
                    disabled={!manualRollInput.trim() || isSubmitting}
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition cursor-pointer shadow-xs"
                  >
                    Scan
                  </button>
                </div>

                {/* Quick 1-Click Test Roster for Class */}
                <div className="pt-2 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Quick Tap:</span>
                  {studentsList.slice(0, 5).map((st) => (
                    <button
                      key={st.id}
                      onClick={() => handleManualScan(st.roll_no)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 transition cursor-pointer"
                    >
                      {st.roll_no} ({st.name.split(' ')[0]})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Last Scanned Confirmation & Live Queue */}
          <div className="lg:col-span-6 space-y-4">
            
            {/* Last Scan Hero Card */}
            {lastScannedResult && (
              <div
                className={`p-5 rounded-3xl border-2 transition-all duration-300 shadow-sm ${
                  lastScannedResult.status === 'present'
                    ? 'bg-emerald-50/80 border-emerald-300'
                    : lastScannedResult.status === 'late'
                    ? 'bg-amber-50/80 border-amber-300'
                    : 'bg-rose-50/80 border-rose-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                      lastScannedResult.status === 'present'
                        ? 'bg-emerald-600 text-white'
                        : lastScannedResult.status === 'late'
                        ? 'bg-amber-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {lastScannedResult.status === 'present' ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <AlertCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                      {lastScannedResult.time} • Scanned Entry
                    </span>
                    <h4 className="text-base font-black text-slate-900">{lastScannedResult.name}</h4>
                    <p className="text-xs font-mono font-bold text-indigo-700">
                      Roll: {lastScannedResult.rollNo} • {lastScannedResult.className}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{lastScannedResult.message}</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                      lastScannedResult.status === 'present'
                        ? 'bg-emerald-600 text-white'
                        : lastScannedResult.status === 'late'
                        ? 'bg-amber-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {lastScannedResult.status}
                  </span>
                </div>
              </div>
            )}

            {/* Recent Scans Stream List */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-indigo-600" /> Recent Scanned Check-Ins ({recentScans.length})
                </h3>
              </div>

              {recentScans.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No students scanned yet in this terminal session.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto">
                  {recentScans.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs hover:bg-slate-100 transition"
                    >
                      <div>
                        <span className="font-bold text-slate-900 block">{item.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">Roll: {item.rollNo} • {item.time}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}
    </div>
  );
}

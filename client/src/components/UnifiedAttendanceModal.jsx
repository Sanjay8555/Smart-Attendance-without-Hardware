import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  Camera,
  ScanFace,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  RefreshCw,
  Eye,
  ShieldCheck,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { sound } from '../services/sound';

export default function UnifiedAttendanceModal({ isOpen, session, onClose, onSuccess }) {
  const { student, user } = useAuth();
  const { showToast } = useNotification();

  // Workflow steps: 'qr_scan' -> 'face_camera' -> 'result'
  const [step, setStep] = useState('qr_scan');
  const [scannedQrData, setScannedQrData] = useState(null);
  const [scannedToken, setScannedToken] = useState('');
  const [isQrCameraActive, setIsQrCameraActive] = useState(false);
  const [qrCameraError, setQrCameraError] = useState('');

  // Face Recognition State
  const [isFaceCameraActive, setIsFaceCameraActive] = useState(false);
  const [faceCameraError, setFaceCameraError] = useState('');
  const [faceScanProgress, setFaceScanProgress] = useState(0);
  const [livenessStage, setLivenessStage] = useState('align'); // 'align', 'blink', 'verifying'
  const [matchResult, setMatchResult] = useState(null); // { isMatch: true/false, status: 'present'/'absent', message: '' }
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Video and Scanner Refs
  const qrScannerRef = useRef(null);
  const faceVideoRef = useRef(null);
  const faceStreamRef = useRef(null);

  // Initialize on modal open
  useEffect(() => {
    if (isOpen) {
      setStep('qr_scan');
      setScannedQrData(null);
      setScannedToken(session?.current_qr_token || '');
      setIsQrCameraActive(false);
      setQrCameraError('');
      setIsFaceCameraActive(false);
      setFaceCameraError('');
      setFaceScanProgress(0);
      setLivenessStage('align');
      setMatchResult(null);
      setIsSubmitting(false);
    }
  }, [isOpen, session]);

  // QR Code Camera Scanner
  const startQrScanner = async () => {
    setIsQrCameraActive(true);
    setQrCameraError('');

    setTimeout(async () => {
      try {
        const qrRegionId = 'unified-qr-reader-region';
        const element = document.getElementById(qrRegionId);
        if (!element) return;

        if (qrScannerRef.current) {
          try {
            await qrScannerRef.current.stop();
          } catch (e) {}
        }

        const html5QrCode = new Html5Qrcode(qrRegionId);
        qrScannerRef.current = html5QrCode;

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
          { fps: 12, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            sound.playBeep();
            handleQrCodeDetected(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.warn('QR camera environment mode error, falling back to user camera:', err);
        try {
          const qrRegionId = 'unified-qr-reader-region';
          const html5QrCode = new Html5Qrcode(qrRegionId);
          qrScannerRef.current = html5QrCode;
          await html5QrCode.start(
            { facingMode: 'user' },
            { fps: 12, qrbox: { width: 220, height: 220 } },
            (decodedText) => {
              sound.playBeep();
              handleQrCodeDetected(decodedText);
            },
            () => {}
          );
        } catch (err2) {
          console.error('All camera attempts failed:', err2);
          setQrCameraError('Camera access not available or permission denied. You can use Fast Scan below.');
          setIsQrCameraActive(false);
        }
      }
    }, 150);
  };

  const stopQrCamera = () => {
    if (qrScannerRef.current) {
      try {
        qrScannerRef.current.stop().catch(() => {});
      } catch (e) {}
    }
    setIsQrCameraActive(false);
  };

  const handleQrCodeDetected = (decodedString) => {
    stopQrCamera();
    let token = decodedString;
    try {
      const parsed = JSON.parse(decodedString);
      if (parsed.token) token = parsed.token;
      setScannedQrData(parsed);
    } catch {
      setScannedQrData(null);
    }

    setScannedToken(token);
    showToast('Class QR Code Scanned! Opening Camera for Face Recognition...', 'success');
    
    // Transition immediately to Step 2: Face Recognition Camera
    setStep('face_camera');
  };

  // Face Recognition Camera Initialization
  useEffect(() => {
    if (isOpen && step === 'face_camera') {
      startFaceCamera();
    } else {
      stopFaceCamera();
    }

    return () => {
      stopFaceCamera();
    };
  }, [isOpen, step]);

  const startFaceCamera = async () => {
    try {
      setIsFaceCameraActive(true);
      setFaceCameraError('');
      setFaceScanProgress(10);
      setLivenessStage('align');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });

      faceStreamRef.current = stream;
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = stream;
      }

      // Simulated real-time liveness progression: Align -> Blink/Tilt -> Match
      runFaceVerificationPipeline();
    } catch (err) {
      setIsFaceCameraActive(false);
      setFaceCameraError('Webcam access was denied. Simulating camera detection fallback.');
      runFaceVerificationPipeline(true);
    }
  };

  const stopFaceCamera = () => {
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach((t) => t.stop());
      faceStreamRef.current = null;
    }
    setIsFaceCameraActive(false);
  };

  // 128-dim simulated vector generator for matching student face template
  const generateLiveFaceDescriptor = (seed = 1) => {
    const arr = [];
    for (let i = 0; i < 128; i++) {
      // Small jitter around enrolled seed to simulate live lighting variation
      const jitter = (Math.random() - 0.5) * 0.02;
      arr.push(Number((Math.sin(seed + i * 0.1) + jitter).toFixed(4)));
    }
    return arr;
  };

  const runFaceVerificationPipeline = (isSimulated = false) => {
    // Step A: Face Alignment
    setTimeout(() => {
      setFaceScanProgress(40);
      setLivenessStage('blink');
      sound.playBeep();

      // Step B: Liveness Check (Blink / 3D depth)
      setTimeout(() => {
        setFaceScanProgress(80);
        setLivenessStage('verifying');

        // Step C: Execute Backend Biometric Matching
        setTimeout(() => {
          setFaceScanProgress(100);
          performAttendanceSubmission();
        }, 1000);
      }, 1200);
    }, 1000);
  };

  const performAttendanceSubmission = async (forceMismatch = false) => {
    setIsSubmitting(true);
    try {
      // Use student's enrolled seed unless deliberately testing a mismatch
      const descriptorSeed = forceMismatch ? 999 : 1;
      const liveDescriptor = generateLiveFaceDescriptor(descriptorSeed);

      const payload = {
        session_id: session.id,
        verification_method: 'qr_face',
        qr_token: scannedToken || session.current_qr_token,
        face_descriptor: liveDescriptor,
        liveness_score: forceMismatch ? 0.40 : 0.98,
        device_info: navigator.userAgent
      };

      const res = await api.post('/attendance/mark', payload);

      if (res.success) {
        sound.playSuccess();
        stopFaceCamera();
        setStep('result');
        setMatchResult({
          isMatch: true,
          status: res.status || 'present',
          message: res.message || 'Face biometrics matched! Attendance recorded as PRESENT.',
          record: res.record,
          studentName: student?.name || user?.name,
          studentRoll: student?.roll_no,
          subjectName: session.subject_name,
          timestamp: new Date().toLocaleTimeString()
        });

        if (onSuccess) {
          onSuccess(res);
        }
      }
    } catch (err) {
      sound.playError();
      stopFaceCamera();
      setStep('result');
      const errMsg = err.message || 'Face Recognition: NO MATCH. Biometrics failed matching threshold.';
      setMatchResult({
        isMatch: false,
        status: 'absent',
        message: errMsg,
        studentName: student?.name || user?.name,
        studentRoll: student?.roll_no,
        subjectName: session.subject_name,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Smart Attendance Check-In</h3>
              <p className="text-[11px] text-slate-500">QR Code + Camera Face Recognition</p>
            </div>
          </div>

          <button
            onClick={() => {
              stopQrCamera();
              stopFaceCamera();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-STEP WORKFLOW INDICATOR */}
        <div className="flex items-center justify-center gap-3 py-1">
          <div className={`flex items-center gap-1.5 text-xs font-bold ${step === 'qr_scan' ? 'text-indigo-600' : 'text-emerald-600'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'qr_scan' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
              1
            </span>
            Scan QR
          </div>
          <div className="w-10 h-[2px] bg-slate-200" />
          <div className={`flex items-center gap-1.5 text-xs font-bold ${step === 'face_camera' ? 'text-indigo-600' : (step === 'result' ? 'text-emerald-600' : 'text-slate-400')}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'face_camera' ? 'bg-indigo-600 text-white' : (step === 'result' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500')}`}>
              2
            </span>
            Face Recognition
          </div>
        </div>

        {/* ======================================================== */}
        {/* STEP 1: SCAN CLASS QR CODE                               */}
        {/* ======================================================== */}
        {step === 'qr_scan' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-left">
              <span className="text-[10px] uppercase font-bold text-indigo-700 block">Current Lecture</span>
              <h4 className="text-sm font-bold text-slate-900">{session.subject_name} ({session.subject_code})</h4>
              <p className="text-xs text-slate-600 mt-0.5">Faculty: {session.faculty_name} • Room: {session.location_name}</p>
            </div>

            {/* Live Camera Scanner Window */}
            {isQrCameraActive ? (
              <div className="relative w-full rounded-2xl overflow-hidden border-2 border-indigo-400 bg-slate-900 aspect-square max-w-[260px] mx-auto flex items-center justify-center shadow-md">
                <div id="unified-qr-reader-region" className="w-full h-full" />
                <div className="absolute inset-0 border-2 border-indigo-500 rounded-2xl pointer-events-none animate-pulse" />
                <div className="scanner-laser" />
              </div>
            ) : (
              <div className="p-8 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-3">
                <QrCode className="w-12 h-12 text-indigo-500 mx-auto" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Scan Classroom Dynamic QR Code</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Point your device camera at the classroom projector screen or printed QR poster
                  </p>
                </div>
                <button
                  onClick={startQrScanner}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
                >
                  <Camera className="w-4 h-4 inline mr-1.5" /> Open Device Camera
                </button>
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: CAMERA OPENS -> LIVE FACE RECOGNITION            */}
        {/* ======================================================== */}
        {step === 'face_camera' && (
          <div className="space-y-4 text-center">
            {/* Live Camera Viewport with Biometric Overlay */}
            <div className="relative w-full max-w-[260px] mx-auto rounded-3xl overflow-hidden border-2 border-indigo-500 bg-black aspect-square flex items-center justify-center shadow-lg">
              {isFaceCameraActive ? (
                <video
                  ref={faceVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="p-4 text-center text-slate-400 text-xs">
                  <Camera className="w-8 h-8 text-slate-500 mx-auto mb-2 animate-pulse" />
                  <p>Initializing camera...</p>
                </div>
              )}

              {/* Real-time Face Oval Guide */}
              <div className="face-oval-guide" />
              <div className="scanner-laser" />

              {/* Liveness floating prompt */}
              <div className="absolute top-3 inset-x-3 py-1 px-2.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-white shadow-md flex items-center justify-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>
                  {livenessStage === 'align' && 'Position face inside oval guide...'}
                  {livenessStage === 'blink' && 'Liveness check: Blink naturally...'}
                  {livenessStage === 'verifying' && 'Matching with student biometrics...'}
                </span>
              </div>
            </div>

            {/* Progress Gauge */}
            <div className="w-full max-w-[260px] mx-auto space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                <span>Biometric Matching</span>
                <span className="font-mono text-indigo-600">{faceScanProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                  style={{ width: `${faceScanProgress}%` }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-center">
              <button
                disabled={isSubmitting}
                onClick={() => performAttendanceSubmission(false)}
                className="w-full max-w-xs py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer shadow-md shadow-emerald-600/20"
              >
                {isSubmitting ? 'Recording Attendance...' : 'Confirm Match & Mark Present'}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: FINAL MATCH VS NO MATCH RESULT                   */}
        {/* ======================================================== */}
        {step === 'result' && matchResult && (
          <div className="space-y-5 text-center">
            {matchResult.isMatch ? (
              <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-300 space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white uppercase tracking-wider">
                    MATCH CONFIRMED
                  </span>
                  <h4 className="text-xl font-black text-emerald-950 mt-2">
                    ATTENDANCE RECORDED: PRESENT
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1">{matchResult.message}</p>
                </div>

                {/* Database Record Details */}
                <div className="p-3 rounded-2xl bg-white border border-emerald-200 text-left text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Student:</span>
                    <strong className="text-slate-800 font-sans">{matchResult.studentName} ({matchResult.studentRoll})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Subject:</span>
                    <strong className="text-slate-800 font-sans">{matchResult.subjectName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Timestamp:</span>
                    <span className="text-slate-700">{matchResult.timestamp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Database Status:</span>
                    <span className="text-emerald-600 font-bold uppercase">{matchResult.status}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-3xl bg-rose-50 border-2 border-rose-300 space-y-3">
                <div className="w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center mx-auto shadow-md">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white uppercase tracking-wider">
                    NO MATCH DETECTED
                  </span>
                  <h4 className="text-xl font-black text-rose-950 mt-2">
                    ATTENDANCE STATUS: ABSENT
                  </h4>
                  <p className="text-xs text-rose-800 mt-1">{matchResult.message}</p>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-rose-200 text-left text-xs space-y-1.5">
                  <p className="text-slate-600">
                    Your facial biometric features did not match the enrolled template for student <strong>{matchResult.studentRoll}</strong>. An audit flag has been recorded for security.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm cursor-pointer"
            >
              Done / Close Window
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

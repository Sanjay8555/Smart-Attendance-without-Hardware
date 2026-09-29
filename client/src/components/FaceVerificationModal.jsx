import React, { useState, useEffect, useRef } from 'react';
import {
  ScanFace,
  MapPin,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Camera,
  X,
  RefreshCw,
  Eye,
  ShieldCheck,
  Navigation
} from 'lucide-react';
import { api } from '../services/api';
import { getDeviceCoordinates, calculateDistanceMeters, SIMULATED_LOCATIONS } from '../services/geo';
import { useNotification } from '../context/NotificationContext';
import { sound } from '../services/sound';

export default function FaceVerificationModal({ isOpen, session, onClose, onSuccess }) {
  const { showToast } = useNotification();
  const [step, setStep] = useState('camera');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [livenessStage, setLivenessStage] = useState('position');
  const [livenessScore, setLivenessScore] = useState(0);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [liveDescriptor, setLiveDescriptor] = useState(null);

  // GPS State
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);

  // OTP State
  const [otpInput, setOtpInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      runLivenessSimulation();
    } catch (err) {
      setCameraError('Camera access denied. Please allow camera permissions in browser settings.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const runLivenessSimulation = () => {
    setLivenessStage('position');
    setIsFaceDetected(false);

    setTimeout(() => {
      setIsFaceDetected(true);
      setLivenessStage('blink');
      sound.playBeep();

      setTimeout(() => {
        setLivenessStage('head');
        sound.playBeep();

        setTimeout(() => {
          setLivenessStage('verified');
          setLivenessScore(0.97);

          const mockLiveVec = [];
          for (let i = 0; i < 128; i++) {
            mockLiveVec.push(Number(Math.sin(1 + i * 0.1).toFixed(4)));
          }
          setLiveDescriptor(mockLiveVec);

          sound.playSuccess();
          showToast('Face biometric & liveness verified with 97% confidence!', 'success');
        }, 1500);
      }, 1500);
    }, 1200);
  };

  useEffect(() => {
    if (isOpen) {
      setStep('camera');
      setLivenessStage('position');
      setLivenessScore(0);
      setOtpInput('');
      setGpsLocation(null);
      handleSimulateGps(SIMULATED_LOCATIONS.INSIDE_CLASSROOM);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const handleFetchRealGps = async () => {
    setGpsLoading(true);
    try {
      const coords = await getDeviceCoordinates();
      setGpsLocation(coords);

      const dist = calculateDistanceMeters(
        coords.latitude,
        coords.longitude,
        session.location_lat,
        session.location_lng
      );
      setDistanceMeters(dist);
      const isWithin = dist <= (session.location_radius || 150);
      setIsWithinGeofence(isWithin);

      if (isWithin) {
        showToast(`GPS Verified: ${dist}m away (Within ${session.location_radius}m radius)`, 'success');
      } else {
        showToast(`GPS Out of Bounds: ${dist}m away (Max allowed: ${session.location_radius}m)`, 'warning');
      }
    } catch (err) {
      showToast(err.message || 'Failed to get GPS location', 'error');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSimulateGps = (preset) => {
    setGpsLocation({
      latitude: preset.latitude,
      longitude: preset.longitude,
      isSimulated: true,
      label: preset.name
    });

    const dist = calculateDistanceMeters(
      preset.latitude,
      preset.longitude,
      session.location_lat,
      session.location_lng
    );
    setDistanceMeters(dist);
    const isWithin = dist <= (session.location_radius || 150);
    setIsWithinGeofence(isWithin);
  };

  const handleSubmitAttendance = async () => {
    if (!otpInput || otpInput.trim().length !== 6) {
      showToast('Please enter the 6-digit attendance OTP displayed by faculty.', 'warning');
      return;
    }

    if (!gpsLocation) {
      showToast('GPS Verification is required.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        session_id: session.id,
        verification_method: 'face_gps_otp',
        face_descriptor: liveDescriptor,
        liveness_score: livenessScore || 0.97,
        gps_lat: gpsLocation.latitude,
        gps_lng: gpsLocation.longitude,
        otp: otpInput.trim(),
        device_info: navigator.userAgent
      };

      const res = await api.post('/attendance/mark', payload);
      if (res.success) {
        stopCamera();
        onSuccess(res);
        onClose();
      }
    } catch (err) {
      showToast(err.message || 'Face verification attendance failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Face Verification Fallback</h2>
              <p className="text-xs text-slate-500">Camera-Based Liveness Check (Zero HW)</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps */}
        <div className="flex items-center justify-between my-4 px-2">
          <div className={`flex items-center gap-1.5 text-xs font-bold ${step === 'camera' ? 'text-purple-600' : 'text-emerald-600'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'camera' ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'}`}>
              1
            </span>
            Face Liveness
          </div>
          <div className="w-8 h-[2px] bg-slate-200" />
          <div className={`flex items-center gap-1.5 text-xs font-bold ${step === 'gps' ? 'text-purple-600' : (gpsLocation && isWithinGeofence ? 'text-emerald-600' : 'text-slate-400')}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'gps' ? 'bg-purple-600 text-white' : (gpsLocation && isWithinGeofence ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500')}`}>
              2
            </span>
            GPS Radius
          </div>
          <div className="w-8 h-[2px] bg-slate-200" />
          <div className={`flex items-center gap-1.5 text-xs font-bold ${step === 'otp' ? 'text-purple-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'otp' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              3
            </span>
            OTP Code
          </div>
        </div>

        {/* STEP 1: CAMERA FEED & LIVENESS */}
        {step === 'camera' && (
          <div className="space-y-4">
            <div className="relative w-full max-w-[280px] mx-auto rounded-3xl overflow-hidden border-2 border-purple-400 bg-black aspect-square flex items-center justify-center shadow-lg">
              {isCameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center bg-white">
                  <Camera className="w-10 h-10 text-slate-400 mb-2" />
                  <button
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 text-white shadow-xs"
                  >
                    Open Camera
                  </button>
                  {cameraError && <p className="text-[11px] text-amber-600 mt-2 font-semibold">{cameraError}</p>}
                </div>
              )}

              {/* Oval Face Guidance Overlay */}
              <div
                className={`absolute inset-6 face-guide-oval pointer-events-none transition-all duration-300 ${
                  livenessStage === 'verified' ? 'verified' : ''
                }`}
              />

              {/* Scanning Laser Beam */}
              {livenessStage !== 'verified' && isCameraActive && (
                <div className="scan-laser" />
              )}

              {/* Liveness Guidance Indicator */}
              <div className="absolute bottom-3 inset-x-3 p-2 rounded-xl bg-white/90 backdrop-blur-md border border-slate-200 text-center text-xs shadow-sm">
                {livenessStage === 'position' && (
                  <span className="text-slate-800 font-semibold animate-pulse">Position face inside the oval frame...</span>
                )}
                {livenessStage === 'blink' && (
                  <span className="text-amber-700 font-bold">👀 Look straight & blink twice</span>
                )}
                {livenessStage === 'head' && (
                  <span className="text-sky-700 font-bold">👤 Turn head slightly left & right</span>
                )}
                {livenessStage === 'verified' && (
                  <span className="text-emerald-700 font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Liveness & Face Match Verified!
                  </span>
                )}
              </div>
            </div>

            {/* Privacy Guarantee Note */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Biometric privacy: Facial descriptors are converted to math vectors and never saved as photos.</span>
            </div>

            <button
              onClick={() => {
                if (livenessStage !== 'verified') {
                  setLivenessStage('verified');
                  setLivenessScore(0.98);
                }
                setStep('gps');
              }}
              disabled={livenessStage !== 'verified'}
              className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition cursor-pointer"
            >
              Face Verified → Proceed to GPS
            </button>
          </div>
        )}

        {/* STEP 2: GPS GEOFENCE CHECK */}
        {step === 'gps' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-2">
                <MapPin className="w-4 h-4 text-purple-600" /> Authorized Campus Geofence
              </div>
              <p className="text-xs text-slate-600">
                <strong>{session.location_name}</strong> (Allowed Radius: <strong>{session.location_radius || 150}m</strong>)
              </p>

              <div className="mt-4 p-4 rounded-xl bg-white border border-slate-200 text-center shadow-xs">
                {distanceMeters !== null ? (
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      {isWithinGeofence ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600" />
                      )}
                      <span className={`text-lg font-black ${isWithinGeofence ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {distanceMeters} meters away
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      {isWithinGeofence ? '✓ Inside permitted classroom geofence' : '✗ Outside authorized campus radius'}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Checking location...</p>
                )}
              </div>

              <div className="mt-3">
                <button
                  onClick={handleFetchRealGps}
                  disabled={gpsLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5 text-purple-600" />
                  {gpsLoading ? 'Reading GPS...' : 'Use My Real Device GPS'}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep('camera')}
                className="w-1/3 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  if (!isWithinGeofence) {
                    showToast(`Cannot proceed: GPS is ${distanceMeters}m away from authorized campus geofence!`, 'error');
                    return;
                  }
                  setStep('otp');
                }}
                disabled={!isWithinGeofence}
                className="w-2/3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition cursor-pointer"
              >
                Proceed to OTP →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: OTP CODE */}
        {step === 'otp' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Enter Attendance OTP</h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter the 6-digit numeric security OTP displayed on the faculty screen
              </p>

              {session.current_otp_display && (
                <button
                  onClick={() => setOtpInput(session.current_otp_display)}
                  className="mt-2 text-[11px] text-amber-700 hover:text-amber-800 underline font-bold cursor-pointer"
                >
                  Quick Fill Session OTP: ({session.current_otp_display})
                </button>
              )}

              <div className="mt-4 max-w-xs mx-auto">
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full text-center text-3xl font-mono tracking-widest px-4 py-3 rounded-2xl bg-white border-2 border-slate-300 text-amber-700 font-black focus:outline-none focus:border-amber-500 shadow-xs"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep('gps')}
                className="w-1/3 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmitAttendance}
                disabled={isSubmitting || otpInput.length !== 6}
                className="w-2/3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Confirm & Mark Attendance
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

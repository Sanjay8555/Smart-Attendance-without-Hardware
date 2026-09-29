import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  MapPin,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Camera,
  X,
  Sparkles,
  RefreshCw,
  Navigation
} from 'lucide-react';
import { api } from '../services/api';
import { getDeviceCoordinates, calculateDistanceMeters, SIMULATED_LOCATIONS } from '../services/geo';
import { useNotification } from '../context/NotificationContext';
import { sound } from '../services/sound';

export default function QrScannerModal({ isOpen, session, onClose, onSuccess }) {
  const { showToast } = useNotification();
  const [step, setStep] = useState('scan');
  const [scannedToken, setScannedToken] = useState('');
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // GPS State
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);

  // OTP State
  const [otpInput, setOtpInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scannerRef = useRef(null);

  const startQrScanner = async () => {
    setIsCameraActive(true);
    setCameraError('');

    setTimeout(async () => {
      try {
        const qrRegionId = 'qr-reader-region';
        const element = document.getElementById(qrRegionId);
        if (!element) return;

        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
          } catch (e) {}
        }

        const html5QrCode = new Html5Qrcode(qrRegionId);
        scannerRef.current = html5QrCode;

        let cameraConfig = { facingMode: { ideal: 'environment' } };
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const chosen = cameras.length > 1 ? cameras[cameras.length - 1] : cameras[0];
            cameraConfig = chosen.id;
          }
        } catch (e) {
          cameraConfig = { facingMode: 'user' };
        }

        await html5QrCode.start(
          cameraConfig,
          { fps: 12, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            sound.playBeep();
            setScannedToken(decodedText);
            stopCamera();
            setStep('gps');
            showToast('Dynamic QR scanned successfully! Proceeding to GPS check.', 'success');
          },
          () => {}
        );
      } catch (err) {
        console.warn('QR camera fallback to user webcam:', err);
        try {
          const qrRegionId = 'qr-reader-region';
          const html5QrCode = new Html5Qrcode(qrRegionId);
          scannerRef.current = html5QrCode;
          await html5QrCode.start(
            { facingMode: 'user' },
            { fps: 12, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              sound.playBeep();
              setScannedToken(decodedText);
              stopCamera();
              setStep('gps');
              showToast('Dynamic QR scanned successfully! Proceeding to GPS check.', 'success');
            },
            () => {}
          );
        } catch (err2) {
          console.error('All camera attempts failed:', err2);
          setCameraError('Camera access denied or unavailable. You can use Quick Fill Token below.');
          setIsCameraActive(false);
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

  useEffect(() => {
    if (isOpen) {
      setStep('scan');
      setScannedToken('');
      setManualTokenInput(session?.current_qr_token || '');
      setGpsLocation(null);
      setDistanceMeters(null);
      setOtpInput('');
      setCameraError('');
      handleSimulateGps(SIMULATED_LOCATIONS.INSIDE_CLASSROOM);
    }
  }, [isOpen, session]);

  const handleFetchRealGps = async () => {
    setGpsLoading(true);
    setGpsError('');
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
      setGpsError(err.message || 'Failed to get GPS location');
      showToast(err.message, 'error');
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

  const handleAcceptToken = (token) => {
    if (!token || !token.trim()) {
      showToast('Please enter or scan a valid QR token.', 'warning');
      return;
    }
    sound.playBeep();
    setScannedToken(token.trim());
    setStep('gps');
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
        verification_method: 'qr_gps_otp',
        qr_token: scannedToken,
        gps_lat: gpsLocation.latitude,
        gps_lng: gpsLocation.longitude,
        otp: otpInput.trim(),
        device_info: navigator.userAgent
      };

      const res = await api.post('/attendance/mark', payload);
      if (res.success) {
        onSuccess(res);
        onClose();
      }
    } catch (err) {
      showToast(err.message || 'Attendance verification failed', 'error');
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
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{session.subject_name}</h2>
              <p className="text-xs text-slate-500">Class: {session.class_name} • Prof: {session.faculty_name}</p>
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

        {/* Multi-Step Wizard Progress Bar */}
        <div className="flex items-center justify-between my-4 px-2">
          <div className={`flex items-center gap-1.5 text-xs font-bold ${step === 'scan' ? 'text-indigo-600' : 'text-emerald-600'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'scan' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
              1
            </span>
            QR Scan
          </div>
          <div className="w-8 h-[2px] bg-slate-200" />
          <div className={`flex items-center gap-1.5 text-xs font-bold ${step === 'gps' ? 'text-indigo-600' : (gpsLocation && isWithinGeofence ? 'text-emerald-600' : 'text-slate-400')}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'gps' ? 'bg-indigo-600 text-white' : (gpsLocation && isWithinGeofence ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500')}`}>
              2
            </span>
            GPS Radius
          </div>
          <div className="w-8 h-[2px] bg-slate-200" />
          <div className={`flex items-center gap-1.5 text-xs font-bold ${step === 'otp' ? 'text-indigo-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'otp' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              3
            </span>
            Enter OTP
          </div>
        </div>

        {/* STEP 1: QR SCANNING */}
        {step === 'scan' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <p className="text-xs text-slate-600 mb-3">
                Scan the dynamic QR code displayed on the faculty screen or use the direct token option:
              </p>

              {/* Camera Scanner Box */}
              {isCameraActive ? (
                <div className="relative w-full max-w-[280px] mx-auto rounded-2xl overflow-hidden border-2 border-indigo-500 bg-black aspect-square flex items-center justify-center">
                  <div id="qr-reader-region" className="w-full h-full" />
                  <div className="scan-laser" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-2xl bg-white">
                  <Camera className="w-10 h-10 text-slate-400 mb-2" />
                  <button
                    onClick={startQrScanner}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm cursor-pointer"
                  >
                    <Camera className="w-4 h-4" /> Open Camera Scanner
                  </button>
                  {cameraError && (
                    <p className="text-[11px] text-amber-600 mt-2 font-semibold">{cameraError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Quick-Fill Active Token Option for Single-Device Testing */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Active Session Token
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Auto-Synced
                </span>
              </div>
              <input
                type="text"
                value={manualTokenInput}
                onChange={(e) => setManualTokenInput(e.target.value)}
                placeholder="Enter or paste session token..."
                className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => handleAcceptToken(manualTokenInput)}
                className="w-full mt-2.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
              >
                Use Token & Proceed to GPS →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: GPS GEOFENCE CHECK */}
        {step === 'gps' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-2">
                <MapPin className="w-4 h-4 text-indigo-600" /> Authorized Geofence Zone
              </div>
              <p className="text-xs text-slate-600">
                <strong>{session.location_name}</strong> (Allowed Radius: <strong>{session.location_radius || 150}m</strong>)
              </p>

              {/* GPS Live Distance Indicator */}
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
                      {isWithinGeofence
                        ? `✓ Inside permitted ${session.location_radius}m radius`
                        : `✗ Violates ${session.location_radius}m radius limit`}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Retrieving device location coordinates...</p>
                )}
              </div>

              <div className="mt-3">
                <button
                  onClick={handleFetchRealGps}
                  disabled={gpsLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                  {gpsLoading ? 'Reading Device GPS...' : 'Use My Real Device GPS'}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep('scan')}
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
                className="w-2/3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition cursor-pointer"
              >
                Proceed to OTP →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: OTP ENTRY & SUBMIT */}
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

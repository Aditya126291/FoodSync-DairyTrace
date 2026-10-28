import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ImageUp, LoaderCircle, QrCode, X } from 'lucide-react';
import { Alert } from './ui';

export default function QrScanner({ title = 'Scan product QR code', description, onScan, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const readerRef = useRef(null);
  const fileRef = useRef(null);
  const [cameraState, setCameraState] = useState('idle'); // idle | starting | ready | denied | unsupported
  const [errorMessage, setErrorMessage] = useState('');
  const [decodingImage, setDecodingImage] = useState(false);

  const stopCamera = () => {
    try {
      controlsRef.current?.stop();
    } catch {
      // ignore
    }
    controlsRef.current = null;

    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject;
        if (stream && typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((track) => track.stop());
        }
        videoRef.current.srcObject = null;
      } catch {
        // ignore
      }
    }
    setCameraState('idle');
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    if (cameraState === 'ready') {
      stopCamera();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      setErrorMessage('Live camera scanning is not available in this browser. Please upload a photo of the QR code instead.');
      return;
    }

    setErrorMessage('');
    setCameraState('starting');

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error, ctrls) => {
          if (result) {
            try {
              ctrls?.stop();
            } catch {
              // ignore
            }
            stopCamera();
            onScan(result.getText());
          }
        }
      );
      controlsRef.current = controls;
      setCameraState('ready');
    } catch (error) {
      stopCamera();
      setCameraState('denied');
      setErrorMessage(
        error?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in your browser settings, or upload an image.'
          : 'Could not access camera. Please check your camera connection or upload an image.'
      );
    }
  };

  const decodeImage = async (file) => {
    if (!file) return;
    setErrorMessage('');
    setDecodingImage(true);
    const imageUrl = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = readerRef.current || new BrowserMultiFormatReader();
      readerRef.current = reader;
      const result = await reader.decodeFromImageUrl(imageUrl);
      if (result) {
        onScan(result.getText());
      } else {
        setErrorMessage('No readable QR code found in that image. Try a clearer, well-lit photo.');
      }
    } catch {
      setErrorMessage('No readable QR code was detected in that image. Please ensure the QR code is clearly visible.');
    } finally {
      URL.revokeObjectURL(imageUrl);
      setDecodingImage(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose?.();
  };

  return (
    <section
      className="card overflow-hidden shadow-pop"
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-4 border-b border-ink-200 p-5 sm:p-6">
        <div>
          <span className="badge badge-safe">QR Scanner</span>
          <h2 className="section-title mt-2">{title}</h2>
          {description && <p className="muted mt-1">{description}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close scanner"
            className="-mr-2 -mt-1 rounded-control p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="p-4 sm:p-6">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink-950 sm:aspect-[16/9]">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
            aria-label="Live QR camera viewfinder"
          />

          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative h-48 w-48 max-h-[70%] max-w-[70%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(15,23,42,0.45)]">
              <span className="scan-corner left-0 top-0 border-l-4 border-t-4" />
              <span className="scan-corner right-0 top-0 border-r-4 border-t-4" />
              <span className="scan-corner bottom-0 left-0 border-b-4 border-l-4" />
              <span className="scan-corner bottom-0 right-0 border-b-4 border-r-4" />
              {cameraState === 'ready' && <span className="scan-line" />}
            </div>
          </div>

          {cameraState !== 'ready' && cameraState !== 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-brand-950/90 to-ink-950/90 px-6 text-center text-white">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <QrCode className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold">Position the product QR code inside the frame</p>
              <p className="text-xs text-brand-200">Point your camera or upload a saved photo of the packaging</p>
            </div>
          )}

          {cameraState === 'starting' && (
            <div className="absolute inset-0 grid place-items-center bg-ink-950/80 text-white">
              <div className="flex flex-col items-center gap-2">
                <LoaderCircle className="h-7 w-7 animate-spin text-brand-400" />
                <span className="text-xs font-medium">Starting camera…</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={startCamera}
            disabled={cameraState === 'starting'}
            className={cameraState === 'ready' ? 'btn btn-secondary flex-1' : 'btn btn-primary flex-1'}
          >
            {cameraState === 'ready' ? (
              <>
                <CameraOff className="h-4 w-4 text-ink-600" />
                Stop camera
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                Start camera scan
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={decodingImage}
            className="btn btn-secondary flex-1"
          >
            {decodingImage ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin text-brand-700" />
                Reading image…
              </>
            ) : (
              <>
                <ImageUp className="h-4 w-4 text-ink-600" />
                Upload QR image
              </>
            )}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Upload a QR code image"
            onChange={(event) => decodeImage(event.target.files?.[0])}
          />
        </div>

        {errorMessage && (
          <div className="mt-4">
            <Alert tone="warn" onClose={() => setErrorMessage('')}>
              {errorMessage}
            </Alert>
          </div>
        )}
      </div>
    </section>
  );
}

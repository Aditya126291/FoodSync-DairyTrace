import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ImageUp, LoaderCircle, QrCode, X } from 'lucide-react';

export default function QrScanner({ title, description, onScan, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const readerRef = useRef(null);
  const fileRef = useRef(null);
  const [cameraState, setCameraState] = useState('idle');
  const [message, setMessage] = useState('');
  const [decodingImage, setDecodingImage] = useState(false);

  useEffect(() => () => controlsRef.current?.stop(), []);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      setMessage('Camera scanning is not available in this browser. Upload a QR image instead.');
      return;
    }
    setMessage('');
    setCameraState('starting');
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (result) {
          controlsRef.current?.stop();
          setCameraState('idle');
          onScan(result.getText());
        }
      });
      setCameraState('ready');
    } catch (error) {
      setCameraState('denied');
      setMessage(error?.name === 'NotAllowedError'
        ? 'Camera access was blocked. Allow camera access in your browser settings, or upload a QR image.'
        : 'We could not start the camera. Upload a QR image to continue.');
    }
  };

  const decodeImage = async (file) => {
    if (!file) return;
    setMessage('');
    setDecodingImage(true);
    const imageUrl = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = readerRef.current || new BrowserMultiFormatReader();
      readerRef.current = reader;
      const result = await reader.decodeFromImageUrl(imageUrl);
      onScan(result.getText());
    } catch {
      setMessage('No readable QR code was found in that image. Try a clearer, well-lit picture.');
    } finally {
      URL.revokeObjectURL(imageUrl);
      setDecodingImage(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-xl shadow-stone-900/5" aria-label={title}>
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">QR scan</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-stone-900">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label="Close scanner" className="rounded-xl p-2 text-stone-500 hover:bg-stone-100"><X className="h-5 w-5" /></button>}
      </div>

      <div className="p-4 sm:p-6">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-950 sm:aspect-[16/8]">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Live QR camera view" />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative h-52 w-52 max-h-[65%] max-w-[65%] rounded-3xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(12,18,16,.35)]">
              <span className="scan-corner left-0 top-0 border-l-4 border-t-4" />
              <span className="scan-corner right-0 top-0 border-r-4 border-t-4" />
              <span className="scan-corner bottom-0 left-0 border-b-4 border-l-4" />
              <span className="scan-corner bottom-0 right-0 border-b-4 border-r-4" />
              {cameraState === 'ready' && <span className="scan-line" />}
            </div>
          </div>
          {cameraState !== 'ready' && cameraState !== 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-emerald-950 to-stone-950 px-6 text-center text-white">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><QrCode className="h-7 w-7" /></span>
              <span className="text-sm font-semibold">Position the product QR inside the frame</span>
            </div>
          )}
          {cameraState === 'starting' && <div className="absolute inset-0 grid place-items-center bg-stone-950/70 text-white"><LoaderCircle className="h-7 w-7 animate-spin" /></div>}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={startCamera} disabled={cameraState === 'starting' || cameraState === 'ready'} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60">
            {cameraState === 'ready' ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {cameraState === 'ready' ? 'Camera is scanning' : 'Start camera scan'}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={decodingImage} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 text-sm font-bold text-stone-800 transition hover:bg-stone-50 disabled:opacity-60">
            {decodingImage ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
            {decodingImage ? 'Reading image…' : 'Upload QR image'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" aria-label="Upload a QR code image" onChange={(event) => decodeImage(event.target.files?.[0])} />
        </div>
        {message && <p role="status" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{message}</p>}
      </div>
    </section>
  );
}

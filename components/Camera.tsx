'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Frame } from '@/lib/frames';

interface Props {
  frame: Frame;
  photoIndex: number;
  totalPhotos: number;
  onCapture: (dataUrl: string, videoBlob: Blob | null) => void;
}

const POST_CAPTURE_MS = 2000;

export default function Camera({ frame, photoIndex, totalPhotos, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Get supported MIME type for MediaRecorder
  const getSupportedMimeType = useCallback((): string => {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'video/webm';
  }, []);

  // Start a fresh recording session — this ensures the first chunk has the WebM header
  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !stream.active) return;
    if (typeof MediaRecorder === 'undefined') return;

    // Clear previous chunks
    chunksRef.current = [];

    const mimeType = getSupportedMimeType();
    let recorder: MediaRecorder;

    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        return;
      }
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    // Record in small chunks for smooth capture
    recorder.start(200);
    recorderRef.current = recorder;
  }, [getSupportedMimeType]);

  // Stop recording and wait for all data to flush
  const stopRecordingAsync = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        recorderRef.current = null;
        resolve();
        return;
      }

      // Force flush any pending data
      try {
        recorder.requestData();
      } catch {
        // ignore
      }

      recorder.onstop = () => {
        recorderRef.current = null;
        setTimeout(resolve, 50);
      };
      recorder.stop();
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (mounted) setReady(true);
        }
      } catch {
        if (mounted) setError('Camera access denied. Please allow camera permissions.');
      }
    };

    initCamera();

    return () => {
      mounted = false;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Capture still frame
    const aspectRatio = frame.layout === 'grid-2x2' ? 1 : 4 / 3;
    canvas.width = 800;
    canvas.height = Math.round(800 / aspectRatio);

    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const targetAR = canvas.width / canvas.height;
    const videoAR = vw / vh;

    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (videoAR > targetAR) {
      sw = vh * targetAR;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetAR;
      sy = (vh - sh) / 2;
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    // Slight vintage tint
    ctx.resetTransform();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(255, 240, 210, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';

    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Continue recording for POST_CAPTURE_MS to get the "after" portion
    setCapturing(true);
    await new Promise((resolve) => setTimeout(resolve, POST_CAPTURE_MS));

    // Stop recording and wait for all data
    await stopRecordingAsync();

    // Merge all chunks into a single blob — since we started a fresh session
    // at countdown start, all chunks form a valid video file with proper headers
    let videoBlob: Blob | null = null;
    if (chunksRef.current.length > 0) {
      const mimeType = chunksRef.current[0].type || 'video/webm';
      videoBlob = new Blob(chunksRef.current, { type: mimeType });
      if (videoBlob.size === 0) videoBlob = null;
    }

    setCapturing(false);
    chunksRef.current = [];

    onCapture(photoDataUrl, videoBlob);
  }, [frame, onCapture, stopRecordingAsync]);

  const startCountdown = useCallback(() => {
    if (countdown !== null || capturing) return;

    // Start a FRESH recording session when countdown begins.
    // This ensures the WebM header is in the first chunk.
    // The countdown is 3 seconds, so we get ~3s before + 2s after = ~5s total clip.
    startRecording();

    let count = 3;
    setCountdown(count);
    const interval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
        setFlash(true);
        setTimeout(() => setFlash(false), 600);
        setTimeout(() => capture(), 100);
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [countdown, capturing, capture, startRecording]);

  const aspectRatio = frame.layout === 'grid-2x2' ? 1 : 4 / 3;

  return (
    <div className="w-full animate-fadeIn">
      <div className="text-center mb-8">
        <p className="text-sm tracking-[0.25em] uppercase opacity-50 mb-2">Step 02</p>
        <h2 className="font-display text-4xl font-bold">
          Photo {photoIndex + 1} <span className="opacity-40">of {totalPhotos}</span>
        </h2>
        <p className="mt-2 opacity-60 text-sm">{frame.emoji} {frame.name}</p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-3 mb-8">
        {Array.from({ length: totalPhotos }).map((_, i) => (
          <div key={i} style={{
            width: i === photoIndex ? 24 : 10,
            height: 10,
            borderRadius: 5,
            background: i < photoIndex ? frame.accentColor : i === photoIndex ? frame.borderColor : `${frame.borderColor}30`,
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      <div className="max-w-lg mx-auto">
        {error ? (
          <div className="p-8 text-center rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            <p className="font-display text-lg mb-3">📷 Camera Unavailable</p>
            <p className="text-sm opacity-70">{error}</p>
          </div>
        ) : (
          <>
            {/* Camera viewfinder */}
            <div className="relative overflow-hidden rounded-sm shadow-2xl"
              style={{
                aspectRatio: String(aspectRatio),
                border: `4px solid ${frame.borderColor}`,
                boxShadow: `0 20px 60px ${frame.borderColor}30`,
              }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)', display: 'block' }}
              />

              {/* Live recording indicator */}
              {ready && !capturing && countdown === null && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-white text-[10px] font-medium tracking-wide">READY</span>
                </div>
              )}

              {/* Recording indicator during countdown */}
              {countdown !== null && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white text-[10px] font-medium tracking-wide">LIVE</span>
                </div>
              )}

              {/* Capturing indicator */}
              {capturing && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(251,191,36,0.3)', border: '1px solid rgba(251,191,36,0.6)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-yellow-200 text-[10px] font-medium tracking-wide">RECORDING</span>
                </div>
              )}

              {/* Viewfinder corners */}
              {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
                <div key={i} className={`absolute ${pos} w-6 h-6`} style={{
                  borderTop: i < 2 ? `3px solid ${frame.accentColor}` : 'none',
                  borderBottom: i >= 2 ? `3px solid ${frame.accentColor}` : 'none',
                  borderLeft: i % 2 === 0 ? `3px solid ${frame.accentColor}` : 'none',
                  borderRight: i % 2 === 1 ? `3px solid ${frame.accentColor}` : 'none',
                }} />
              ))}

              {/* Loading overlay */}
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center"
                  style={{ background: `${frame.color}ee` }}>
                  <div className="text-center">
                    <div className="w-10 h-10 border-4 border-t-transparent rounded-full mx-auto mb-3 animate-spin"
                      style={{ borderColor: frame.borderColor, borderTopColor: 'transparent' }} />
                    <p className="text-sm opacity-60">Starting camera...</p>
                  </div>
                </div>
              )}

              {/* Flash effect */}
              {flash && (
                <div className="absolute inset-0 animate-flash pointer-events-none"
                  style={{ background: 'white' }} />
              )}

              {/* Countdown */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <div className="text-white font-display text-9xl font-black"
                    style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                    {countdown}
                  </div>
                </div>
              )}

              {/* Photo label */}
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <span className="text-xs px-3 py-1 rounded-full"
                  style={{ background: `${frame.borderColor}cc`, color: frame.color, letterSpacing: '0.15em' }}>
                  PHOTO {photoIndex + 1}/{totalPhotos}
                </span>
              </div>
            </div>

            {/* Shutter button */}
            <div className="flex flex-col items-center mt-8 gap-4">
              <button
                onClick={startCountdown}
                disabled={!ready || countdown !== null || capturing}
                className="relative"
                style={{ cursor: ready && countdown === null && !capturing ? 'pointer' : 'not-allowed' }}
              >
                <div style={{
                  width: 80, height: 80,
                  borderRadius: '50%',
                  background: 'var(--cream)',
                  border: `4px solid ${frame.borderColor}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                  opacity: ready && countdown === null && !capturing ? 1 : 0.5,
                  boxShadow: `0 4px 20px ${frame.borderColor}30`,
                }}>
                  <div style={{
                    width: 44, height: 44,
                    borderRadius: '50%',
                    background: countdown !== null || capturing ? 'var(--accent)' : frame.borderColor,
                    transition: 'background 0.3s',
                  }} />
                </div>

                {/* Pulse rings when counting or capturing */}
                {(countdown !== null || capturing) && (
                  <>
                    {[1, 2].map(r => (
                      <div key={r} style={{
                        position: 'absolute',
                        inset: -r * 12,
                        borderRadius: '50%',
                        border: `2px solid ${frame.accentColor}`,
                        animation: `pulse-ring 1s ease-out ${r * 0.2}s infinite`,
                      }} />
                    ))}
                  </>
                )}
              </button>
              <p className="text-xs opacity-40 tracking-widest uppercase">
                {capturing ? 'Recording motion...' : countdown !== null ? `Shooting in ${countdown}...` : 'Press to take photo'}
              </p>
            </div>
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

'use client';
import { useEffect } from 'react';
import { useLivePhotoRecorder } from '@/hooks/useLivePhotoRecorder';
import PreviewModal from './PreviewModal';

export default function LivePhotoCamera() {
  const {
    videoRef,
    permissionState,
    recordingState,
    isLoading,
    error,
    result,
    startCamera,
    capture,
    reset,
    stopCamera,
  } = useLivePhotoRecorder();

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBuffering = recordingState === 'buffering';
  const isCapturing = recordingState === 'capturing';
  const isProcessing = recordingState === 'processing';
  const canCapture = isBuffering && !isLoading;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: '#0a0a0a' }}>

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="font-display text-3xl font-bold text-white">Live Photo</h1>
        <p className="text-white/50 text-sm mt-1">Captures 2s before + 2s after</p>
      </div>

      {/* Permission denied state */}
      {permissionState === 'denied' && (
        <div className="w-full max-w-md p-8 rounded-2xl text-center"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-4xl mb-4">🚫</div>
          <h2 className="text-white font-display text-xl font-bold mb-2">Camera Access Denied</h2>
          <p className="text-white/50 text-sm mb-6">
            Please allow camera access in your browser settings to use Live Photo.
          </p>
          <button
            onClick={startCamera}
            className="px-6 py-3 rounded-lg font-medium text-sm"
            style={{ background: 'white', color: '#0a0a0a' }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Unsupported browser */}
      {permissionState === 'unsupported' && (
        <div className="w-full max-w-md p-8 rounded-2xl text-center"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-white font-display text-xl font-bold mb-2">Browser Not Supported</h2>
          <p className="text-white/50 text-sm">
            Your browser does not support the required camera APIs. Please use a modern browser like Chrome, Firefox, or Safari.
          </p>
        </div>
      )}

      {/* Camera view */}
      {permissionState !== 'denied' && permissionState !== 'unsupported' && (
        <div className="w-full max-w-md">
          {/* Viewfinder */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl"
            style={{
              aspectRatio: '16/9',
              background: '#111',
              border: '2px solid rgba(255,255,255,0.1)',
            }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.7)' }}>
                <div className="text-center">
                  <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-white/70 text-sm">Starting camera...</p>
                </div>
              </div>
            )}

            {/* Processing overlay */}
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.7)' }}>
                <div className="text-center">
                  <div className="w-10 h-10 border-3 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-white/70 text-sm">Processing live photo...</p>
                </div>
              </div>
            )}

            {/* Recording indicator */}
            {isBuffering && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-xs font-medium">LIVE</span>
              </div>
            )}

            {/* Capturing countdown indicator */}
            {isCapturing && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,200,0,0.3)', border: '1px solid rgba(255,200,0,0.6)' }}>
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-yellow-200 text-xs font-medium">CAPTURING...</span>
              </div>
            )}

            {/* Corner guides */}
            {['top-3 left-3', 'top-3 right-3', 'bottom-3 left-3', 'bottom-3 right-3'].map((pos, i) => (
              <div key={i} className={`absolute ${pos} w-5 h-5 pointer-events-none`} style={{
                borderTop: i < 2 ? '2px solid rgba(255,255,255,0.4)' : 'none',
                borderBottom: i >= 2 ? '2px solid rgba(255,255,255,0.4)' : 'none',
                borderLeft: i % 2 === 0 ? '2px solid rgba(255,255,255,0.4)' : 'none',
                borderRight: i % 2 === 1 ? '2px solid rgba(255,255,255,0.4)' : 'none',
              }} />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 rounded-lg text-center"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Shutter button */}
          <div className="flex flex-col items-center mt-8 gap-3">
            <button
              onClick={capture}
              disabled={!canCapture}
              className="relative group"
              aria-label="Capture live photo"
            >
              {/* Outer ring */}
              <div className="w-20 h-20 rounded-full flex items-center justify-center transition-all"
                style={{
                  border: '4px solid rgba(255,255,255,0.8)',
                  opacity: canCapture ? 1 : 0.4,
                  cursor: canCapture ? 'pointer' : 'not-allowed',
                }}>
                {/* Inner circle */}
                <div className="w-14 h-14 rounded-full transition-all group-hover:scale-90 group-active:scale-75"
                  style={{
                    background: isCapturing
                      ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                      : 'white',
                    boxShadow: canCapture ? '0 0 20px rgba(255,255,255,0.3)' : 'none',
                  }} />
              </div>

              {/* Pulse animation when capturing */}
              {isCapturing && (
                <>
                  <div className="absolute inset-0 rounded-full animate-ping"
                    style={{ border: '2px solid rgba(251,191,36,0.5)' }} />
                </>
              )}
            </button>

            <p className="text-white/40 text-xs tracking-widest uppercase">
              {isCapturing ? 'Recording...' : isProcessing ? 'Processing...' : 'Tap to capture'}
            </p>
          </div>

          {/* Info */}
          <div className="mt-8 text-center">
            <p className="text-white/30 text-xs">
              The camera continuously buffers. When you tap, it saves 2 seconds before and after.
            </p>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {result && (
        <PreviewModal
          result={result}
          onRetake={reset}
          onClose={reset}
        />
      )}
    </div>
  );
}

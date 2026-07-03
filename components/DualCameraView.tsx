import React, { RefObject } from 'react';
import { Frame } from '@/lib/frames';
import { CaptureMode } from './DatePhotobooth';

interface DualCameraViewProps {
  currentAspectRatio: number;
  isMobile: boolean;
  activeFrame: Frame;
  captureMode: CaptureMode;
  isMe: "left" | "right";
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  countdown: number | null;
  isCapturing: boolean;
  photoCount: number;
}

export default function DualCameraView({
  currentAspectRatio,
  isMobile,
  activeFrame,
  captureMode,
  isMe,
  localVideoRef,
  remoteVideoRef,
  countdown,
  isCapturing,
  photoCount
}: DualCameraViewProps) {
  return (
    <div className="relative overflow-hidden rounded-sm shadow-2xl transition-all duration-300 flex"
      style={{
        aspectRatio: String(currentAspectRatio),
        width: '100%',
        maxWidth: isMobile ? `min(100%, 60vh * ${currentAspectRatio})` : `min(32rem, 55vh * ${currentAspectRatio})`,
        border: `4px solid ${activeFrame.borderColor}`,
        boxShadow: `0 20px 60px ${activeFrame.borderColor}30`,
        background: activeFrame.color,
      }}
    >
      <div className="w-1/2 h-full relative" style={{ display: captureMode === 'right' ? 'none' : 'block', width: captureMode === 'merged' ? '50%' : '100%' }}>
        <video
          ref={isMe === "left" ? localVideoRef : remoteVideoRef}
          autoPlay
          muted={true}
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)', display: 'block' }}
        />
        <div className="absolute bottom-2 left-2 text-[10px] font-mono opacity-50 text-white bg-black/30 px-2 py-0.5 rounded">
          {isMe === "left" ? "YOU" : "DATE"}
        </div>
      </div>
      <div className="w-1/2 h-full relative" style={{ display: captureMode === 'left' ? 'none' : 'block', width: captureMode === 'merged' ? '50%' : '100%', borderLeft: captureMode === 'merged' ? `2px solid ${activeFrame.borderColor}` : 'none' }}>
        <video
          ref={isMe === "left" ? remoteVideoRef : localVideoRef}
          autoPlay
          muted={true}
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)', display: 'block' }}
        />
        <div className="absolute bottom-2 left-2 text-[10px] font-mono opacity-50 text-white bg-black/30 px-2 py-0.5 rounded">
          {isMe === "left" ? "DATE" : "YOU"}
        </div>
      </div>

      {/* Live / Capturing indicator */}
      {countdown !== null && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-[10px] font-medium tracking-wide">LIVE</span>
        </div>
      )}
      {isCapturing && countdown === null && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(251,191,36,0.3)', border: '1px solid rgba(251,191,36,0.6)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-yellow-200 text-[10px] font-medium tracking-wide">RECORDING</span>
        </div>
      )}

      {/* Viewfinder corners */}
      {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
        <div key={i} className={`absolute ${pos} w-6 h-6`} style={{
          borderTop: i < 2 ? `3px solid ${activeFrame.accentColor}` : 'none',
          borderBottom: i >= 2 ? `3px solid ${activeFrame.accentColor}` : 'none',
          borderLeft: i % 2 === 0 ? `3px solid ${activeFrame.accentColor}` : 'none',
          borderRight: i % 2 === 1 ? `3px solid ${activeFrame.accentColor}` : 'none',
        }} />
      ))}

      {/* Countdown */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className={`text-white font-display font-black ${isMobile ? 'text-6xl' : 'text-9xl'}`}
            style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            {countdown}
          </div>
        </div>
      )}

      {/* Photo label */}
      <div className="absolute bottom-3 left-0 right-0 text-center">
        <span className="text-xs px-3 py-1 rounded-full"
          style={{ background: `${activeFrame.borderColor}cc`, color: activeFrame.color, letterSpacing: '0.15em' }}>
          PHOTO {Math.min(photoCount + 1, activeFrame.photoCount)}/{activeFrame.photoCount}
        </span>
      </div>
    </div>
  );
}

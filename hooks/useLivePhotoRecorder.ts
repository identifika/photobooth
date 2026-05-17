'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import {
  TimestampedChunk,
  LivePhotoResult,
  PermissionState,
  RecordingState,
} from '@/types/live-photo';
import { captureFrame } from '@/utils/captureFrame';
import { mergeChunks, pruneChunks } from '@/utils/mergeChunks';

const BUFFER_DURATION_MS = 2000;
const POST_CAPTURE_MS = 2000;
const MAX_BUFFER_AGE_MS = 3000;
const CHUNK_INTERVAL_MS = 200;
const PRUNE_INTERVAL_MS = 500;

interface UseLivePhotoRecorderReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  permissionState: PermissionState;
  recordingState: RecordingState;
  isLoading: boolean;
  error: string | null;
  result: LivePhotoResult | null;
  startCamera: () => Promise<void>;
  capture: () => Promise<void>;
  reset: () => void;
  stopCamera: () => void;
}

export function useLivePhotoRecorder(): UseLivePhotoRecorderReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<TimestampedChunk[]>([]);
  const pruneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureResolveRef = useRef<(() => void) | null>(null);

  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LivePhotoResult | null>(null);

  // Check browser support
  const checkSupport = useCallback((): boolean => {
    if (typeof navigator === 'undefined') return false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    if (typeof MediaRecorder === 'undefined') return false;
    return true;
  }, []);

  // Get supported MIME type
  const getSupportedMimeType = useCallback((): string => {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'video/webm';
  }, []);

  // Start the prune interval to keep buffer clean
  const startPruning = useCallback(() => {
    if (pruneTimerRef.current) return;
    pruneTimerRef.current = setInterval(() => {
      chunksRef.current = pruneChunks(chunksRef.current, MAX_BUFFER_AGE_MS);
    }, PRUNE_INTERVAL_MS);
  }, []);

  const stopPruning = useCallback(() => {
    if (pruneTimerRef.current) {
      clearInterval(pruneTimerRef.current);
      pruneTimerRef.current = null;
    }
  }, []);

  // Start MediaRecorder
  const startRecording = useCallback((stream: MediaStream) => {
    const mimeType = getSupportedMimeType();
    let recorder: MediaRecorder;

    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });
    } catch {
      // Fallback without options
      recorder = new MediaRecorder(stream);
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push({
          blob: event.data,
          timestamp: Date.now(),
        });
      }
    };

    recorder.onerror = () => {
      setError('Recording failed. Please try again.');
      setRecordingState('idle');
    };

    recorder.start(CHUNK_INTERVAL_MS);
    recorderRef.current = recorder;
    setRecordingState('buffering');
    startPruning();
  }, [getSupportedMimeType, startPruning]);

  // Stop MediaRecorder
  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    stopPruning();
  }, [stopPruning]);

  // Start camera
  const startCamera = useCallback(async () => {
    if (!checkSupport()) {
      setPermissionState('unsupported');
      setError('Your browser does not support camera access or MediaRecorder.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setPermissionState('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start continuous recording for the buffer
      startRecording(stream);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Camera access failed';
      if (message.includes('Permission') || message.includes('NotAllowed')) {
        setPermissionState('denied');
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else {
        setError(`Camera error: ${message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [checkSupport, startRecording]);

  // Capture live photo
  const capture = useCallback(async () => {
    if (!videoRef.current || !streamRef.current) {
      setError('Camera not ready');
      return;
    }

    if (recordingState === 'capturing' || recordingState === 'processing') {
      return; // Prevent spam clicking
    }

    setRecordingState('capturing');
    setError(null);

    const captureTime = Date.now();

    try {
      // Step 1 & 2: Capture still frame
      const photoBlob = await captureFrame(videoRef.current);
      const photoUrl = URL.createObjectURL(photoBlob);

      // Step 3: Previous chunks are already in the buffer
      // Step 4: Continue recording for POST_CAPTURE_MS more
      await new Promise<void>((resolve) => {
        captureResolveRef.current = resolve;
        postCaptureTimerRef.current = setTimeout(() => {
          captureResolveRef.current = null;
          resolve();
        }, POST_CAPTURE_MS);
      });

      // Step 5: Stop recording and merge chunks
      setRecordingState('processing');
      stopRecording();

      // Small delay to ensure last chunks are flushed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 6: Merge chunks around capture time
      const videoBlob = mergeChunks(
        chunksRef.current,
        captureTime,
        BUFFER_DURATION_MS,
        POST_CAPTURE_MS
      );
      const videoUrl = URL.createObjectURL(videoBlob);

      // Step 7: Set result
      const livePhotoResult: LivePhotoResult = {
        photoBlob,
        photoUrl,
        videoBlob,
        videoUrl,
        createdAt: captureTime,
      };

      setResult(livePhotoResult);
      setRecordingState('idle');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Capture failed';
      setError(message);
      setRecordingState('buffering');

      // Restart recording if stream is still active
      if (streamRef.current && streamRef.current.active) {
        chunksRef.current = [];
        startRecording(streamRef.current);
      }
    }
  }, [recordingState, stopRecording, startRecording]);

  // Reset state for retake
  const reset = useCallback(() => {
    // Revoke old URLs
    if (result) {
      URL.revokeObjectURL(result.photoUrl);
      URL.revokeObjectURL(result.videoUrl);
    }

    setResult(null);
    setError(null);
    chunksRef.current = [];

    // Restart recording if stream is still active
    if (streamRef.current && streamRef.current.active) {
      startRecording(streamRef.current);
    }
  }, [result, startRecording]);

  // Stop camera completely
  const stopCamera = useCallback(() => {
    stopRecording();

    if (postCaptureTimerRef.current) {
      clearTimeout(postCaptureTimerRef.current);
      postCaptureTimerRef.current = null;
    }

    if (captureResolveRef.current) {
      captureResolveRef.current();
      captureResolveRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Revoke URLs
    if (result) {
      URL.revokeObjectURL(result.photoUrl);
      URL.revokeObjectURL(result.videoUrl);
    }

    chunksRef.current = [];
    setRecordingState('idle');
    setResult(null);
  }, [stopRecording, result]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPruning();

      if (postCaptureTimerRef.current) {
        clearTimeout(postCaptureTimerRef.current);
      }

      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stopPruning]);

  return {
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
  };
}

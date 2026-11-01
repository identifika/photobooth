import type { PoseLandmarker as PoseLandmarkerType } from '@mediapipe/tasks-vision';

let landmarkerPromise: Promise<PoseLandmarkerType | null> | null = null;
let landmarkerInstance: PoseLandmarkerType | null = null;

const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm';
const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/**
 * Initializes and caches the MediaPipe PoseLandmarker singleton.
 */
export async function getPoseLandmarker(maxPeople = 4): Promise<PoseLandmarkerType | null> {
  if (typeof window === 'undefined') return null;
  if (landmarkerInstance) return landmarkerInstance;
  if (landmarkerPromise) return landmarkerPromise;

  landmarkerPromise = (async () => {
    try {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);

      try {
        // Try GPU delegate first for smooth performance
        landmarkerInstance = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: maxPeople,
          minPoseDetectionConfidence: 0.4,
          minPosePresenceConfidence: 0.4,
          minTrackingConfidence: 0.4,
        });
      } catch (gpuErr) {
        console.warn('PoseLandmarker GPU delegate failed, falling back to CPU:', gpuErr);
        // Fallback to CPU delegate if WebGL/WebGPU is unavailable
        landmarkerInstance = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: maxPeople,
          minPoseDetectionConfidence: 0.4,
          minPosePresenceConfidence: 0.4,
          minTrackingConfidence: 0.4,
        });
      }

      return landmarkerInstance;
    } catch (err) {
      console.error('Failed to initialize PoseLandmarker:', err);
      landmarkerPromise = null;
      return null;
    }
  })();

  return landmarkerPromise;
}

/**
 * Perform live pose detection on a HTMLVideoElement
 */
export function detectVideoPose(
  landmarker: PoseLandmarkerType,
  video: HTMLVideoElement,
  timestampMs: number = performance.now()
) {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }
  try {
    return landmarker.detectForVideo(video, timestampMs);
  } catch (err) {
    console.warn('detectForVideo error:', err);
    return null;
  }
}

/**
 * Release landmarker resources if needed
 */
export function closePoseLandmarker() {
  if (landmarkerInstance) {
    try {
      landmarkerInstance.close();
    } catch {
      // ignore
    }
    landmarkerInstance = null;
    landmarkerPromise = null;
  }
}


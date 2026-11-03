import type { ImageSegmenter as ImageSegmenterType } from '@mediapipe/tasks-vision';

let segmenterPromise: Promise<ImageSegmenterType | null> | null = null;
let segmenterInstance: ImageSegmenterType | null = null;

const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm';
const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

/**
 * Initializes and caches the MediaPipe Selfie Segmenter singleton.
 * Runs in ~30ms on GPU/WebGL (used by Google Meet for real-time background blur).
 */
export async function getFastSegmenter(): Promise<ImageSegmenterType | null> {
  if (typeof window === 'undefined') return null;
  if (segmenterInstance) return segmenterInstance;
  if (segmenterPromise) return segmenterPromise;

  segmenterPromise = (async () => {
    try {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);

      try {
        segmenterInstance = await ImageSegmenter.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: 'GPU',
          },
          runningMode: 'IMAGE',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      } catch (gpuErr) {
        console.warn('ImageSegmenter GPU failed, falling back to CPU:', gpuErr);
        segmenterInstance = await ImageSegmenter.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: 'CPU',
          },
          runningMode: 'IMAGE',
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      }
      return segmenterInstance;
    } catch (err) {
      console.error('Failed to init FastSegmenter:', err);
      segmenterPromise = null;
      return null;
    }
  })();

  return segmenterPromise;
}

/**
 * Preloads the 250KB Selfie Segmenter model in the background
 */
export function preloadFastSegmenter() {
  getFastSegmenter().catch(() => {});
}

/**
 * Super-fast background removal on an image element or data URL.
 * Takes ~30-50ms (nearly 100x faster than MODNet CPU).
 */
export async function fastRemoveBg(
  imageSource: HTMLImageElement | HTMLCanvasElement | string
): Promise<HTMLCanvasElement> {
  // If string data URL, load into image element first
  let imgElement: HTMLImageElement | HTMLCanvasElement;
  if (typeof imageSource === 'string') {
    imgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageSource;
    });
  } else {
    imgElement = imageSource;
  }

  const segmenter = await getFastSegmenter();
  const origW = imgElement.width || (imgElement as HTMLImageElement).naturalWidth || 640;
  const origH = imgElement.height || (imgElement as HTMLImageElement).naturalHeight || 480;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = origW;
  outCanvas.height = origH;
  const outCtx = outCanvas.getContext('2d')!;

  if (!segmenter) {
    // Fallback: draw original
    outCtx.drawImage(imgElement, 0, 0, origW, origH);
    return outCanvas;
  }

  try {
    const result = segmenter.segment(imgElement);
    if (!result || !result.confidenceMasks || result.confidenceMasks.length === 0) {
      outCtx.drawImage(imgElement, 0, 0, origW, origH);
      return outCanvas;
    }

    const mask = result.confidenceMasks[0];
    const maskW = mask.width;
    const maskH = mask.height;
    const confidences = mask.getAsFloat32Array();

    // Create mask canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskW;
    maskCanvas.height = maskH;
    const maskCtx = maskCanvas.getContext('2d')!;
    const maskImgData = maskCtx.createImageData(maskW, maskH);
    const d = maskImgData.data;

    // Apply soft confidence threshold for smooth anti-aliased hair/body edges
    for (let i = 0; i < confidences.length; i++) {
      const c = confidences[i];
      // Smooth cutoff between 0.35 and 0.8
      let alpha = 0;
      if (c > 0.7) {
        alpha = 255;
      } else if (c > 0.3) {
        alpha = Math.round(((c - 0.3) / 0.4) * 255);
      }

      const idx = i * 4;
      d[idx] = 255;
      d[idx + 1] = 255;
      d[idx + 2] = 255;
      d[idx + 3] = alpha;
    }

    maskCtx.putImageData(maskImgData, 0, 0);

    // Composite: draw original image then mask with destination-in
    outCtx.drawImage(imgElement, 0, 0, origW, origH);
    outCtx.globalCompositeOperation = 'destination-in';
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(maskCanvas, 0, 0, origW, origH);
    outCtx.globalCompositeOperation = 'source-over';

    mask.close();
    return outCanvas;
  } catch (err) {
    console.warn('Fast segmentation error, falling back to original:', err);
    outCtx.drawImage(imgElement, 0, 0, origW, origH);
    return outCanvas;
  }
}

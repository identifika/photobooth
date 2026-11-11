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

export interface SegmentResult {
  canvas: HTMLCanvasElement;
  bounds: {
    centerX: number; // normalized 0..1
    centerY: number;
    width: number;
    height: number;
    hasPerson: boolean;
  };
}

/**
 * Super-fast background removal on an image element or data URL.
 * Takes ~30-50ms (nearly 100x faster than MODNet CPU).
 * Includes smooth edge feathering and person bounding box detection.
 */
export async function fastRemoveBg(
  imageSource: HTMLImageElement | HTMLCanvasElement | string
): Promise<SegmentResult> {
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

  const defaultBounds = { centerX: 0.5, centerY: 0.5, width: 1, height: 1, hasPerson: false };

  if (!segmenter) {
    // Fallback: draw original
    outCtx.drawImage(imgElement, 0, 0, origW, origH);
    return { canvas: outCanvas, bounds: defaultBounds };
  }

  try {
    const result = segmenter.segment(imgElement);
    if (!result || !result.confidenceMasks || result.confidenceMasks.length === 0) {
      outCtx.drawImage(imgElement, 0, 0, origW, origH);
      return { canvas: outCanvas, bounds: defaultBounds };
    }

    const mask = result.confidenceMasks[0];
    const maskW = mask.width;
    const maskH = mask.height;
    const confidences = mask.getAsFloat32Array();

    // 1. Detect person bounds and center in mask coordinates (256x256)
    let minX = maskW;
    let maxX = 0;
    let minY = maskH;
    let maxY = 0;
    let personPixelCount = 0;

    for (let y = 0; y < maskH; y++) {
      for (let x = 0; x < maskW; x++) {
        const i = y * maskW + x;
        const c = confidences[i];
        if (c > 0.15) {
          personPixelCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const hasPerson = personPixelCount > 50;
    const bounds = {
      centerX: hasPerson ? (minX + maxX) / (2 * maskW) : 0.5,
      centerY: hasPerson ? (minY + maxY) / (2 * maskH) : 0.5,
      width: hasPerson ? (maxX - minX) / maskW : 1,
      height: hasPerson ? (maxY - minY) / maskH : 1,
      hasPerson,
    };

    // 2. Create raw confidence mask
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskW;
    maskCanvas.height = maskH;
    const maskCtx = maskCanvas.getContext('2d')!;
    const maskImgData = maskCtx.createImageData(maskW, maskH);
    const d = maskImgData.data;

    // Relaxed threshold curve with smoothstep Hermite interpolation:
    // Prevents clipping into hair, clothes, and shoulders ("terlalu mepet")
    // c >= 0.45: solid person
    // c between 0.08 and 0.45: smooth anti-aliased rolloff
    // c <= 0.08: background transparent
    for (let i = 0; i < confidences.length; i++) {
      const c = confidences[i];
      let alpha = 0;
      if (c >= 0.45) {
        alpha = 255;
      } else if (c > 0.08) {
        const t = (c - 0.08) / (0.45 - 0.08);
        alpha = Math.round(t * t * (3 - 2 * t) * 255);
      }

      const idx = i * 4;
      d[idx] = 255;
      d[idx + 1] = 255;
      d[idx + 2] = 255;
      d[idx + 3] = alpha;
    }

    maskCtx.putImageData(maskImgData, 0, 0);

    // 3. Feather the mask with subtle Gaussian blur matching target resolution
    // Softens 256px upscaling artifacts into natural camera optical depth-of-field
    const featheredCanvas = document.createElement('canvas');
    featheredCanvas.width = origW;
    featheredCanvas.height = origH;
    const fCtx = featheredCanvas.getContext('2d')!;
    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = 'high';
    if ('filter' in fCtx) {
      fCtx.filter = 'blur(2px)';
    }
    fCtx.drawImage(maskCanvas, 0, 0, origW, origH);
    if ('filter' in fCtx) {
      fCtx.filter = 'none';
    }

    // 4. Composite: draw original image masked with feathered destination-in
    outCtx.drawImage(imgElement, 0, 0, origW, origH);
    outCtx.globalCompositeOperation = 'destination-in';
    outCtx.drawImage(featheredCanvas, 0, 0, origW, origH);
    outCtx.globalCompositeOperation = 'source-over';

    mask.close();
    return { canvas: outCanvas, bounds };
  } catch (err) {
    console.warn('Fast segmentation error, falling back to original:', err);
    outCtx.drawImage(imgElement, 0, 0, origW, origH);
    return { canvas: outCanvas, bounds: defaultBounds };
  }
}


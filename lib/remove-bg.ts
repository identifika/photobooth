'use client';
import { pipeline, env } from '@huggingface/transformers';

// Configure to load models from custom CDN instead of Hugging Face
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.aramadani.my.id';
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.remoteHost = `${CDN_URL.replace(/\/+$/, '')}/`;
env.remotePathTemplate = 'photobooth/models/{model}/';
env.useBrowserCache = true;

let segmenterPromise: Promise<any> | null = null;

export function preloadBgModel() {
  return getSegmenter();
}

function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = pipeline('background-removal', 'modnet', {
      dtype: 'q8', // Loads onnx/model_quantized.onnx (6.6 MB)
    });
  }
  return segmenterPromise;
}

/**
 * Remove background from a single image.
 * Returns a data URL with transparent background.
 */
export async function removeBg(src: string): Promise<string> {
  const segmenter = await getSegmenter();
  const output = await segmenter([src]);
  
  if (!output || !output[0]) {
    throw new Error('No output from background removal model');
  }

  const rawImg = output[0];
  const canvas = rawImg.toCanvas ? rawImg.toCanvas() : rawImg;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = canvas.width;
  outCanvas.height = canvas.height;
  const ctx = outCanvas.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0);
  return outCanvas.toDataURL('image/png');
}

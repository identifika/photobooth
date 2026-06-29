'use client';
import { pipeline, env } from '@huggingface/transformers';

// Configure to cache models in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

let segmenterPromise: Promise<any> | null = null;
let fetchConfigured = false;

function configureFetchWithToken() {
  if (fetchConfigured) return;
  fetchConfigured = true;
  
  const hfToken = typeof window !== 'undefined' 
    ? (window as any).__NEXT_PUBLIC_HF_TOKEN 
    : null;
  
  if (hfToken) {
    const origFetch = env.fetch ?? globalThis.fetch;
    env.fetch = (input: string | URL, init?: any) => {
      return origFetch(input, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${hfToken}`,
        },
      });
    };
  }
}

function getSegmenter() {
  if (!segmenterPromise) {
    configureFetchWithToken();

    segmenterPromise = pipeline('background-removal', 'Xenova/modnet', {
      dtype: 'q4',
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

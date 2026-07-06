import { useState, useCallback } from 'react';
import GIF from 'gif.js';
import { Frame } from '@/lib/frames';
import { DEFAULT_EDIT_CONFIG } from '@/lib/edit-types';
import { downloadFile } from '@/lib/download';

export function useGifGenerator(
  photos: string[],
  frame: Frame,
  filter: string | undefined,
  liveClips?: (string[] | null)[]
) {
  const [gifDataUrl, setGifDataUrl] = useState('');
  const [generatingGif, setGeneratingGif] = useState(false);
  const [downloadingGif, setDownloadingGif] = useState(false);

  const [liveClipGifs, setLiveClipGifs] = useState<(string | null | 'pending' | 'error')[]>([]);
  const [generatingClipGifs, setGeneratingClipGifs] = useState(false);

  const generateGif = useCallback(async () => {
    setGeneratingGif(true);
    try {
      const PHOTO_W = 600;
      const filterCss = filter ? (DEFAULT_EDIT_CONFIG.presets.find(f => f.id === filter)?.css || 'none') : 'none';
      let currentAspectRatio = frame.layout === 'grid-2x2' ? 1 : 4 / 3;
      if (frame.config?.elements) {
        const photoSlots = frame.config.elements.filter(el => el.type === 'photo');
        if (photoSlots.length > 0) {
          const smallestSlot = photoSlots.reduce((prev, curr) => {
            return (prev.width * prev.height) < (curr.width * curr.height) ? prev : curr;
          });
          if (smallestSlot.width && smallestSlot.height) {
            currentAspectRatio = smallestSlot.width / smallestSlot.height;
          }
        }
      }
      const PHOTO_H = Math.round(PHOTO_W / currentAspectRatio);

      const gif = new GIF({
        workers: 2, quality: 10, workerScript: '/gif.worker.js',
        width: PHOTO_W, height: PHOTO_H,
      });

      const imgs = await Promise.all(photos.map(src => new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      })));

      imgs.forEach(img => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = PHOTO_W;
        tempCanvas.height = PHOTO_H;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true })!;

        // object-fit: cover logic to avoid stretching
        const imgRatio = img.width / img.height;
        const canvasRatio = PHOTO_W / PHOTO_H;
        let dw = PHOTO_W, dh = PHOTO_H, dx = 0, dy = 0;

        if (imgRatio > canvasRatio) {
          dh = PHOTO_H;
          dw = PHOTO_H * imgRatio;
          dx = (PHOTO_W - dw) / 2;
        } else {
          dw = PHOTO_W;
          dh = PHOTO_W / imgRatio;
          dy = (PHOTO_H - dh) / 2;
        }

        if (filterCss !== 'none') ctx.filter = filterCss;
        ctx.drawImage(img, dx, dy, dw, dh);
        if (filterCss !== 'none') ctx.filter = 'none';
        // Pass ImageData directly to avoid gif.js creating a readback-expensive context
        const imageData = ctx.getImageData(0, 0, PHOTO_W, PHOTO_H);
        gif.addFrame(imageData, { delay: 500, copy: true });
      });

      await new Promise<void>((resolve, reject) => {
        gif.on('finished', (blob: Blob) => {
          const reader = new FileReader();
          reader.onloadend = () => { setGifDataUrl(reader.result as string); resolve(); };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        gif.render();
      });
    } catch (err) {
      console.error('Strip GIF generation failed:', err);
    } finally {
      setGeneratingGif(false);
    }
  }, [photos, frame, filter]);

  const convertClipToGif = useCallback(async (frames: string[]): Promise<string> => {
    const firstImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = frames[0]!;
    });
    const gif = new GIF({ workers: 2, quality: 8, workerScript: '/gif.worker.js', width: firstImg.width, height: firstImg.height });
    const canvas = document.createElement('canvas');
    canvas.width = firstImg.width;
    canvas.height = firstImg.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    for (const frameSrc of frames) {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = frameSrc;
      });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      gif.addFrame(ctx.getImageData(0, 0, canvas.width, canvas.height), { delay: 150 });
    }
    const blob = await new Promise<Blob>((resolve) => { gif.on('finished', resolve); gif.render(); });
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  const generateClipGifs = useCallback(async () => {
    if (!liveClips || !liveClips.some(c => c !== null)) return;
    setGeneratingClipGifs(true);
    setLiveClipGifs(liveClips.map(c => (c ? 'pending' : null)));
    for (let i = 0; i < liveClips.length; i++) {
      const frames = liveClips[i];
      if (!frames || frames.length === 0) { setLiveClipGifs(prev => { const next = [...prev]; next[i] = null; return next; }); continue; }
      try {
        const gifUrl = await convertClipToGif(frames);
        setLiveClipGifs(prev => { const next = [...prev]; next[i] = gifUrl; return next; });
      } catch (err) {
        console.error(`Clip ${i} GIF failed:`, err);
        setLiveClipGifs(prev => { const next = [...prev]; next[i] = 'error'; return next; });
      }
    }
    setGeneratingClipGifs(false);
  }, [liveClips, convertClipToGif]);

  const handleDownloadGif = async () => {
    if (!gifDataUrl) return;
    setDownloadingGif(true);
    try {
      await downloadFile(gifDataUrl, `photobooth-${frame.id}-${Date.now()}.gif`);
    } catch (err) {
      console.error('Download GIF failed:', err);
    }
    setTimeout(() => setDownloadingGif(false), 1500);
  };

  const downloadClipGif = async (gifUrl: string, index: number) => {
    try {
      await downloadFile(gifUrl, `photobooth-${frame.id}-live${index + 1}-${Date.now()}.gif`);
    } catch (err) {
      console.error('Download clip failed:', err);
    }
  };

  return {
    gifDataUrl,
    generatingGif,
    downloadingGif,
    liveClipGifs,
    generatingClipGifs,
    generateGif,
    generateClipGifs,
    handleDownloadGif,
    downloadClipGif
  };
}

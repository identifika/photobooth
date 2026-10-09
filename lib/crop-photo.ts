import { Frame } from '@/lib/frames';

/** Aspect ratio of the photo slot at `index`, matching the live camera crop. */
export function getPhotoSlotAspect(frame: Frame, index: number): number {
  let aspectRatio = frame.layout === 'grid-2x2' ? 1 : 4 / 3;
  if (frame.config?.elements) {
    const photos = frame.config.elements.filter((el) => el.type === 'photo');
    const target = photos[index] || photos[0];
    if (target?.width && target?.height) {
      aspectRatio = target.width / target.height;
    }
  }
  return aspectRatio > 0 ? aspectRatio : 4 / 3;
}

/**
 * Center-crops a device photo to the frame slot and returns a JPEG data URL.
 * Orientation is taken from the file so phone photos are not sideways.
 */
export async function cropFileToAspect(file: File, aspectRatio: number): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Could not read that photo. Try a JPEG or PNG.');
  }

  try {
    const maxWidth = 1920;
    const width = maxWidth;
    const height = Math.max(1, Math.round(maxWidth / aspectRatio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare that photo.');

    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const targetAR = width / height;
    const imageAR = srcW / srcH;
    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;
    if (imageAR > targetAR) {
      sw = srcH * targetAR;
      sx = (srcW - sw) / 2;
    } else {
      sh = srcW / targetAR;
      sy = (srcH - sh) / 2;
    }

    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.92);
  } finally {
    bitmap.close();
  }
}

import QRCode from 'qrcode';

export interface QrRenderOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Generates a QR Code as a Data URL (PNG image)
 */
export async function generateQrDataUrl(
  text: string,
  options?: QrRenderOptions
): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: options?.width || 256,
      margin: options?.margin ?? 1,
      color: {
        dark: options?.color?.dark || '#000000',
        light: options?.color?.light || '#ffffff',
      },
      errorCorrectionLevel: options?.errorCorrectionLevel || 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR data URL:', err);
    return '';
  }
}

/**
 * Draws a QR code directly onto an existing Canvas 2D rendering context at (x, y, w, h).
 */
export async function drawQrOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  options?: QrRenderOptions
): Promise<void> {
  try {
    const dataUrl = await generateQrDataUrl(text, {
      ...options,
      width: Math.max(w * 2, 256), // crisp resolution
    });
    if (!dataUrl) return;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, x, y, w, h);
        resolve();
      };
      img.onerror = () => {
        resolve();
      };
      img.src = dataUrl;
    });
  } catch (err) {
    console.error('Failed to draw QR code on canvas:', err);
  }
}

import { PoseReference } from './types';
import { getPoseLandmarker } from './detector';
import { extractPose } from './vector';

const STORAGE_KEY = 'photobooth_custom_poses';

export function loadCustomPoses(): PoseReference[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load custom poses from localStorage:', err);
    return [];
  }
}

export function saveCustomPose(pose: PoseReference): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadCustomPoses().filter((p) => p.id !== pose.id);
    const updated = [pose, ...current].slice(0, 20); // keep up to 20 custom poses
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save custom pose:', err);
  }
}

export function deleteCustomPose(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const updated = loadCustomPoses().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to delete custom pose:', err);
  }
}

/**
 * Reads an uploaded image file, detects human poses using MediaPipe,
 * and converts it into a stored PoseReference.
 */
export async function extractPoseFromImageFile(file: File): Promise<PoseReference> {
  const landmarker = await getPoseLandmarker(4);
  if (!landmarker) {
    throw new Error('Gagal memuat model deteksi pose. Periksa koneksi internet Anda.');
  }

  // 1. Load image into HTMLImageElement
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Gagal memuat format gambar.'));
    img.src = dataUrl;
  });

  // 2. Draw image to canvas with standard bounds (max 640x640 for fast inference & thumbnail)
  const maxDim = 640;
  let w = img.width;
  let h = img.height;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Gagal menginisialisasi canvas.');
  }
  ctx.drawImage(img, 0, 0, w, h);

  // 3. Detect pose
  const res = landmarker.detectForVideo(canvas, performance.now());
  if (!res || !res.landmarks || res.landmarks.length === 0) {
    throw new Error(
      'Tidak ada orang yang terdeteksi di foto ini. Pastikan foto menampilkan tubuh bagian atas dengan jelas.'
    );
  }

  // Regular photo input (not mirrored selfie stream)
  const extracted = extractPose(res.landmarks, false);
  if (!extracted || extracted.vec.length === 0) {
    throw new Error('Pose tidak dapat dianalisis. Coba foto lain dengan sudut tubuh yang lebih jelas.');
  }

  const thumb = canvas.toDataURL('image/jpeg', 0.82);
  const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 16) || 'Pose Kustom';

  const newPose: PoseReference = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    description: `${extracted.people} Orang terdeteksi dari foto kamu`,
    category: 'cute',
    people: extracted.people,
    vec: extracted.vec,
    skeleton: extracted.landmarks,
    emoji: '📸',
    thumb,
    isCustom: true,
  };

  saveCustomPose(newPose);
  return newPose;
}


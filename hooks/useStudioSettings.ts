'use client';
import { useState, useEffect } from 'react';
import { fsGetDocument } from '@/lib/firestore';

export interface StudioSettings {
  studioName: string;
  studioLogo: string; // emoji or image URL
  tagline: string;
}

const DEFAULT_SETTINGS: StudioSettings = {
  studioName: 'Pika',
  studioLogo: '📷',
  tagline: 'Capture the moment',
};

const DOC_PATH = 'public_settings/studio';

export function useStudioSettings() {
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    let cancelled = false;

    fsGetDocument(DOC_PATH)
      .then((doc) => {
        if (cancelled || !doc) return;
        setSettings({ ...DEFAULT_SETTINGS, ...doc.data as Partial<StudioSettings> });
      })
      .catch((err) => {
        console.error('Failed to load studio settings:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => { cancelled = true; };
  }, []);

  const updateSettings = async (newSettings: Partial<StudioSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      const { fsUpdateDocument } = await import('@/lib/firestore');
      await fsUpdateDocument(DOC_PATH, updated as unknown as Record<string, unknown>);
    } catch (e) {
      console.error('Failed to update studio settings:', e);
    }
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      const { fsUpdateDocument } = await import('@/lib/firestore');
      await fsUpdateDocument(DOC_PATH, DEFAULT_SETTINGS as unknown as Record<string, unknown>);
    } catch (e) {
      console.error('Failed to reset studio settings:', e);
    }
  };

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoaded,
  };
}

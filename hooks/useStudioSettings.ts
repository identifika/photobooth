'use client';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';

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

export function useStudioSettings() {
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    let cancelled = false;

    apiFetch<StudioSettings>('/api/settings')
      .then((data) => {
        if (cancelled || !data) return;
        setSettings({ ...DEFAULT_SETTINGS, ...data });
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
      await apiFetch('/api/settings', { method: 'PUT', json: updated });
    } catch (e) {
      console.error('Failed to update studio settings:', e);
    }
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      await apiFetch('/api/settings', { method: 'PUT', json: DEFAULT_SETTINGS });
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

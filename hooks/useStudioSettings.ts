'use client';
import { useState, useEffect } from 'react';

export interface StudioSettings {
  studioName: string;
  studioLogo: string; // emoji or image URL
  tagline: string;
}

const DEFAULT_SETTINGS: StudioSettings = {
  studioName: 'Photobooth',
  studioLogo: '📷',
  tagline: 'Capture the moment',
};

const STORAGE_KEY = 'photobooth_studio_settings';

export function useStudioSettings() {
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      } catch (e) {
        console.error('Failed to parse studio settings:', e);
      }
    }
    setIsLoaded(true);
  }, []);

  const updateSettings = (newSettings: Partial<StudioSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
  };

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoaded,
  };
}
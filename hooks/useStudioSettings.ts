'use client';
import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

const DOC_ID = 'studio';
const COLLECTION = 'public_settings';

export function useStudioSettings() {
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings on mount and listen to changes
  useEffect(() => {
    const ref = doc(db, COLLECTION, DOC_ID);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...snap.data() as Partial<StudioSettings> });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
      setIsLoaded(true);
    }, (error) => {
      console.error('Failed to parse studio settings from Firestore:', error);
      setIsLoaded(true); // Still set loaded on error so the app doesn't hang
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: Partial<StudioSettings>) => {
    const updated = { ...settings, ...newSettings };
    // Optimistic update
    setSettings(updated);
    try {
      const ref = doc(db, COLLECTION, DOC_ID);
      await setDoc(ref, updated, { merge: true });
    } catch (e) {
      console.error('Failed to update studio settings in Firestore:', e);
    }
  };

  const resetSettings = async () => {
    // Optimistic update
    setSettings(DEFAULT_SETTINGS);
    try {
      const ref = doc(db, COLLECTION, DOC_ID);
      await setDoc(ref, DEFAULT_SETTINGS);
    } catch (e) {
      console.error('Failed to reset studio settings in Firestore:', e);
    }
  };

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoaded,
  };
}
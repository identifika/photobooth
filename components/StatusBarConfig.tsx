'use client';
import { useEffect } from 'react';

export default function StatusBarConfig() {
  useEffect(() => {
    const initStatusBar = async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setStyle({ style: Style.Default });
      } catch {
        // Not on native — ignore
      }
    };
    initStatusBar();
  }, []);

  return null;
}

'use client';

import { useEffect } from 'react';
import { useStudioSettings } from '@/hooks/useStudioSettings';
import { isImageUrl } from './StudioLogo';

function updateFavicon(href: string, type?: string) {
  if (typeof document === 'undefined') return;

  // Select or create link tags
  const iconRels = ['icon', 'shortcut icon', 'apple-touch-icon'];

  iconRels.forEach((rel) => {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
    if (type) {
      link.type = type;
    } else {
      link.removeAttribute('type');
    }
  });
}

function getMimeType(url: string): string {
  if (url.includes('.webp')) return 'image/webp';
  if (url.includes('.png')) return 'image/png';
  if (url.includes('.svg')) return 'image/svg+xml';
  if (url.includes('.jpg') || url.includes('.jpeg')) return 'image/jpeg';
  if (url.includes('.gif')) return 'image/gif';
  return 'image/x-icon';
}

function emojiToSvgDataUri(emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function WebMetadataSync() {
  const { settings, isLoaded } = useStudioSettings();

  useEffect(() => {
    if (!isLoaded || !settings) return;

    const logo = settings.studioLogo?.trim();
    if (logo) {
      if (isImageUrl(logo)) {
        updateFavicon(logo, getMimeType(logo));
      } else {
        // Emoji logo -> SVG data URI favicon
        updateFavicon(emojiToSvgDataUri(logo), 'image/svg+xml');
      }
    }
  }, [settings?.studioLogo, isLoaded]);

  return null;
}

'use client';

import React, { useState, useEffect } from 'react';

export function isImageUrl(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  ) {
    return true;
  }
  return /\.(webp|png|jpe?g|gif|svg|avif|ico)(\?.*)?$/i.test(trimmed);
}

interface StudioLogoProps {
  logo?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  fallback?: string;
}

export default function StudioLogo({
  logo,
  alt = 'Logo',
  className = '',
  style,
  fallback = '📷',
}: StudioLogoProps) {
  const [hasError, setHasError] = useState(false);

  // Reset error state when logo prop changes
  useEffect(() => {
    setHasError(false);
  }, [logo]);

  const isImage = logo && isImageUrl(logo) && !hasError;

  if (isImage) {
    return (
      <img
        src={logo}
        alt={alt}
        className={className}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      {logo && !isImageUrl(logo) ? logo : fallback}
    </span>
  );
}

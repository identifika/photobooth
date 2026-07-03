import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface ShareSectionProps {
  displayUploadedUrl?: string;
}

export default function ShareSection({ displayUploadedUrl }: ShareSectionProps) {
  if (!displayUploadedUrl) return null;

  return (
    <div className="mb-8 text-center animate-slideUp" style={{ animationDelay: '0.1s' }}>
      <h3 className="text-sm font-medium mb-3 opacity-70">Scan to Download</h3>
      <div className="inline-block p-4 bg-white rounded-xl shadow-lg border border-border">
        <QRCodeSVG value={displayUploadedUrl} size={160} />
      </div>
      <div className="mt-3">
        <a href={displayUploadedUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
          {displayUploadedUrl}
        </a>
      </div>
    </div>
  );
}

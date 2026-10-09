'use client';

import { Camera, Image as ImageIcon } from 'lucide-react';

export type CaptureSource = 'camera' | 'device';

const OPTIONS: { id: CaptureSource; label: string }[] = [
  { id: 'camera', label: 'Camera' },
  { id: 'device', label: 'From device' },
];

interface Props {
  value: CaptureSource;
  onChange: (value: CaptureSource) => void;
}

export default function CaptureModeSwitch({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="How to add photos" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: 12, background: 'var(--surface-0)', border: '0.5px solid var(--border)' }}>
      {OPTIONS.map((option) => {
        const active = value === option.id;
        const Icon = option.id === 'camera' ? Camera : ImageIcon;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 36,
              padding: '0 10px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              background: active ? 'var(--surface-2)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

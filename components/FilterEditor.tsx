'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FilterPreset, DEFAULT_ADJUSTMENTS, ImageAdjustments, DEFAULT_EDIT_CONFIG } from '@/lib/edit-types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Props {
  initialConfig?: FilterPreset;
  onSave: (config: FilterPreset) => void;
  onCancel: () => void;
}

export default function FilterEditor({ initialConfig, onSave, onCancel }: Props) {
  const [config, setConfig] = useState<FilterPreset>(
    initialConfig || {
      id: `filter_${Date.now()}`,
      name: 'New Filter',
      emoji: '🎨',
      adjustments: { ...DEFAULT_ADJUSTMENTS }
    }
  );

  const [previewImage, setPreviewImage] = useState<string>('/sample-portrait.jpg');

  useEffect(() => {
    return () => {
      if (previewImage.startsWith('blob:')) {
        URL.revokeObjectURL(previewImage);
      }
    };
  }, [previewImage]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewImage((prev) => {
        if (prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return url;
      });
    }
  };

  const handleAdjustmentChange = (key: keyof ImageAdjustments, value: number) => {
    setConfig(prev => ({
      ...prev,
      adjustments: { ...prev.adjustments, [key]: value }
    }));
  };

  const previewCss = [
    config.adjustments.brightness !== 100 ? `brightness(${config.adjustments.brightness}%)` : '',
    config.adjustments.contrast !== 100 ? `contrast(${config.adjustments.contrast}%)` : '',
    config.adjustments.saturation !== 100 ? `saturate(${config.adjustments.saturation}%)` : '',
    config.adjustments.hue !== 0 ? `hue-rotate(${config.adjustments.hue}deg)` : '',
    config.adjustments.blur > 0 ? `blur(${config.adjustments.blur}px)` : '',
    config.adjustments.sepia > 0 ? `sepia(${config.adjustments.sepia}%)` : '',
    config.adjustments.grayscale > 0 ? `grayscale(${config.adjustments.grayscale}%)` : '',
    config.adjustments.invert > 0 ? `invert(${config.adjustments.invert}%)` : '',
  ].filter(Boolean).join(' ') || 'none';

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] w-full">
      {/* Left: Preview Area */}
      <div className="flex-1 bg-surface-0 flex flex-col items-center justify-center p-8 border-r border-border relative">
        <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl bg-black/10">
          <img 
            src={previewImage} 
            alt="Preview" 
            className="w-full h-full object-cover"
            style={{ filter: previewCss }}
            onError={(e) => {
              // Fallback if the image doesn't exist
              e.currentTarget.src = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop';
            }}
          />
          {config.adjustments.temperature !== 0 && (
            <div className="absolute inset-0 pointer-events-none" style={{
              background: config.adjustments.temperature > 0 ? '#ff8c00' : '#0066ff',
              opacity: Math.abs(config.adjustments.temperature) / 300,
              mixBlendMode: 'overlay',
            }} />
          )}
          {config.adjustments.vignette > 0 && (
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `radial-gradient(circle, transparent 30%, rgba(0,0,0,${config.adjustments.vignette / 100}) 100%)`,
            }} />
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <label className="cursor-pointer bg-surface-1 hover:bg-accent border border-border px-4 py-2 rounded-md text-sm font-medium transition shadow-sm hover:shadow">
            Upload Image
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload} 
            />
          </label>
          <label className="cursor-pointer bg-surface-1 hover:bg-accent border border-border px-4 py-2 rounded-md text-sm font-medium transition shadow-sm hover:shadow">
            Take Photo
            <input 
              type="file" 
              accept="image/*" 
              capture="user"
              className="hidden" 
              onChange={handleImageUpload} 
            />
          </label>
        </div>
      </div>

      {/* Right: Controls Panel */}
      <div className="w-full md:w-[400px] flex flex-col bg-surface-1 h-full overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold font-display">Edit Filter</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" onClick={() => onSave({...config, css: previewCss})}>Save</Button>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div>
            <label className="text-xs font-semibold mb-1 block">Filter Name</label>
            <Input 
              value={config.name} 
              onChange={e => setConfig({...config, name: e.target.value})}
              placeholder="e.g. My Vintage Filter"
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block">Emoji</label>
            <Input 
              value={config.emoji} 
              onChange={e => setConfig({...config, emoji: e.target.value})}
              maxLength={2}
              className="w-16 text-center"
            />
          </div>
        </div>

        <div className="space-y-6">
          {DEFAULT_EDIT_CONFIG.sliders.map(slider => (
            <div key={slider.key}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-medium tracking-wide uppercase opacity-70">{slider.label}</label>
                <span className="text-[10px] font-mono opacity-50 text-right bg-surface-0 px-1 py-0.5 rounded">
                  {config.adjustments[slider.key]}
                </span>
              </div>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                value={config.adjustments[slider.key]}
                onChange={e => handleAdjustmentChange(slider.key, Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-primary/20 accent-primary"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

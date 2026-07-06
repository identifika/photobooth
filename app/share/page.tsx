'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getClientAuthToken } from '@/lib/auth-client';
import Image from 'next/image';
import { Download, Loader2, Image as ImageIcon, Video, Home } from 'lucide-react';
import Link from 'next/link';
import JSZip from 'jszip';

interface MediaItem {
  key: string;
  url: string;
  size: number;
}

function SharePageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('s');
  
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    getClientAuthToken().then(token => {
      fetch('/api/share', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ sessionId })
      })
        .then(res => {
          if (!res.ok) throw new Error('Session not found');
          return res.json();
        })
        .then(data => {
          if (data.items) {
            setItems(data.items);
          } else {
            setError('No items found');
          }
        })
        .catch(err => {
          setError(err.message || 'Failed to load session');
        })
        .finally(() => {
          setLoading(false);
        });
    });
  }, [sessionId]);

  const downloadFile = (url: string, filename: string) => {
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch(console.error);
  };

  const handleDownloadAll = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      
      const fetchPromises = items.map(async (item) => {
        const response = await fetch(item.url);
        if (!response.ok) throw new Error(`Failed to fetch ${item.key}`);
        const blob = await response.blob();
        const filename = item.key.split('/').pop() || 'file';
        zip.file(filename, blob);
      });
      
      await Promise.all(fetchPromises);
      
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `photobooth-${sessionId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to create zip', err);
      alert('Failed to download zip file');
    } finally {
      setDownloadingZip(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl mb-6">
          <p className="font-medium text-lg">Oops!</p>
          <p>{error}</p>
        </div>
        <Link href="/" className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity">
          Back to Home
        </Link>
      </div>
    );
  }

  const stripItem = items.find(i => i.key.includes('strip.png'));
  const otherItems = items.filter(i => !i.key.includes('strip.png'));

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors">
            <Home className="w-5 h-5 text-muted-foreground" />
          </Link>
          <h1 className="font-semibold text-lg">Your Memories</h1>
        </div>
        <button 
          onClick={handleDownloadAll}
          disabled={downloadingZip}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {downloadingZip ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {downloadingZip ? 'Zipping...' : 'Download All'}
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 space-y-12">
        {/* Hero Section (The Strip) */}
        {stripItem && (
          <section className="animate-slideUp" style={{ animationDelay: '0.1s' }}>
            <div className="bg-[var(--surface-2)] rounded-3xl p-4 md:p-8 border border-border shadow-sm flex flex-col items-center gap-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" />
                Final Strip
              </h2>
              <div className="relative max-w-sm w-full mx-auto shadow-2xl rounded overflow-hidden">
                <img 
                  src={stripItem.url} 
                  alt="Photobooth Strip" 
                  className="w-full h-auto"
                  crossOrigin="anonymous" 
                />
              </div>
              <button 
                onClick={() => downloadFile(stripItem.url, 'strip.png')}
                className="flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity w-full max-w-xs justify-center"
              >
                <Download className="w-4 h-4" />
                Download Strip
              </button>
            </div>
          </section>
        )}

        {/* Individual Photos and Clips */}
        {otherItems.length > 0 && (
          <section className="animate-slideUp" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Photos & Live Clips
            </h3>
            
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
              {otherItems.map((item, idx) => {
                const isGif = item.key.endsWith('.gif');
                const filename = item.key.split('/').pop() || 'photo';
                return (
                  <div key={item.key} className="group relative bg-muted rounded-2xl overflow-hidden break-inside-avoid">
                    <img 
                      src={item.url} 
                      alt={filename}
                      className="w-full h-auto block transition-transform group-hover:scale-105"
                      crossOrigin="anonymous"
                    />
                    
                    {/* Badge */}
                    {isGif && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[10px] font-bold tracking-wider text-white uppercase">
                        GIF
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                      <button 
                        onClick={() => downloadFile(item.url, filename)}
                        className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full transition-colors transform translate-y-4 group-hover:translate-y-0"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <SharePageContent />
    </Suspense>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOwnerPublicBackgrounds, useUserBackgrounds } from '@/hooks/useBackgrounds';
import { createUserBackground, deleteUserBackground } from '@/lib/user-backgrounds';
import { deletePublicBackgroundAsOwner } from '@/lib/public-backgrounds';
import { requestBackgroundPublish } from '@/lib/publish-requests';
import { Trash2, Plus, X } from 'lucide-react';
import { useDialog } from '@/components/ui/dialog-provider';
import type { BackgroundOption } from '@/lib/edit-types';
import { getClientAuthToken } from '@/lib/auth-client';

export function MyBackgrounds({ isAuthorized }: { isAuthorized: boolean }) {
  const { user } = useAuth();
  const { alert, confirm } = useDialog();
  
  const { data: myPublishedBackgrounds = [], isLoading: publishedLoading, mutate: mutatePublished } = useOwnerPublicBackgrounds(user?.uid);
  const { data: myCustomBackgrounds = [], isLoading: customLoading, mutate: mutateCustom } = useUserBackgrounds(user?.uid);

  const [publishingBgId, setPublishingBgId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Gradient Creator state
  const [creatingGradient, setCreatingGradient] = useState(false);
  const [gradName, setGradName] = useState('My Gradient');
  const [gradType, setGradType] = useState<'linear' | 'radial' | 'conic'>('linear');
  const [gradColors, setGradColors] = useState<string[]>(['#ff7e5f', '#feb47b']);
  const [gradAngle, setGradAngle] = useState(135);

  const getGradientSrc = () => {
    const colorsStr = gradColors.join(', ');
    if (gradType === 'linear') {
      return `linear-gradient(${gradAngle}deg, ${colorsStr})`;
    } else if (gradType === 'radial') {
      return `radial-gradient(circle, ${colorsStr})`;
    } else {
      return `conic-gradient(from ${gradAngle}deg, ${colorsStr})`;
    }
  };

  const handleSaveGradient = async () => {
    if (!user) return;
    if (!gradName) {
      await alert('Please give your gradient a name.');
      return;
    }
    setUploading(true);
    try {
      const src = getGradientSrc();
      await createUserBackground({
        type: 'gradient',
        name: gradName,
        src,
        ownerUid: user.uid,
        ownerName: user.displayName,
      });
      await mutateCustom();
      setCreatingGradient(false);
    } catch (err: any) {
      console.error(err);
      await alert(err.message || 'Failed to save gradient.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      if (mountedRef.current) setUploading(true);
      try {
        const token = await getClientAuthToken();
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            image: dataUrl,
            prefix: `backgrounds/users/${user.uid}`,
          }),
        });

        if (!res.ok) {
          throw new Error('Upload failed');
        }
        
        const data = await res.json();
        
        await createUserBackground({
          type: 'upload',
          name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
          src: data.url,
          ownerUid: user.uid,
          ownerName: user.displayName,
        });

        if (mountedRef.current) await mutateCustom();
      } catch (err: any) {
        console.error(err);
        if (mountedRef.current) await alert(err.message || 'Failed to upload image.');
      } finally {
        if (mountedRef.current) {
          setUploading(false);
          if (e.target) e.target.value = '';
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteCustom = async (id: string) => {
    const ok = await confirm('Delete this draft? This cannot be undone.');
    if (!ok || !user) return;
    try {
      await deleteUserBackground(user.uid, id);
      await mutateCustom((prev = []) => prev.filter(b => b.id !== id), { revalidate: false });
    } catch (err: any) {
      await alert(err.message || 'Failed to delete');
    }
  };

  const handleDeletePublished = async (id: string) => {
    if (!user) return;
    const ok = await confirm('Unpublish this background? It will be removed from the community.');
    if (!ok) return;
    try {
      const deleted = await deletePublicBackgroundAsOwner(id, user.uid);
      if (deleted) {
        await mutatePublished((prev = []) => prev.filter(b => b.id !== id), { revalidate: false });
      }
    } catch (err: any) {
      await alert(err.message || 'Failed to unpublish');
    }
  };

  const handlePublish = async (bg: BackgroundOption & { id: string }) => {
    if (!user) return;
    setPublishingBgId(bg.id);
    try {
      await requestBackgroundPublish(bg.id, user, bg);
      await alert('Publish request sent! An admin will review it.');
    } catch (err: any) {
      console.error(err);
      await alert('Failed to send publish request.');
    }
    setPublishingBgId(null);
  };

  return (
    <div style={{ padding: 20 }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 15 }}>🌄</span>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Backgrounds & Gradients</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreatingGradient(true)}
            className="btn primary"
            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
          >
            + Gradient
          </button>
          <label
            className="btn primary cursor-pointer m-0 flex items-center justify-center"
            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
          >
            {uploading ? '...' : '+ Photo'}
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleUpload} />
          </label>
        </div>
      </div>

      {/* Custom Backgrounds */}
      <p className="text-xs mb-2 mt-4" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>My Drafts</p>
      {customLoading ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : myCustomBackgrounds.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No custom backgrounds yet.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {myCustomBackgrounds.map((bg) => (
            <div key={bg.id} className="flex items-center gap-3" style={{
              padding: '8px 10px', background: 'var(--surface-1)', borderRadius: 8, border: '0.5px solid var(--border)',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: bg.type === 'gradient' ? bg.src : 'var(--surface-2)', overflow: 'hidden' }}>
                {bg.type !== 'gradient' && <img src={bg.src} alt={bg.name} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{bg.name || 'Untitled'}</p>
                <p className="text-[10px] uppercase text-muted-foreground">{bg.type}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handlePublish(bg as any)} disabled={publishingBgId === bg.id}
                  style={{ height: 26, padding: '0 8px', borderRadius: 6, background: publishingBgId === bg.id ? 'var(--text-muted)' : 'var(--brand)', color: '#fff', fontSize: 11, opacity: publishingBgId === bg.id ? 0.7 : 1, border: 'none', cursor: 'pointer' }}>
                  {publishingBgId === bg.id ? '...' : (isAuthorized ? 'Publish' : 'Submit')}
                </button>
                <button onClick={() => handleDeleteCustom(bg.id)}
                  style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface-2)', border: '0.5px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Published Backgrounds */}
      <p className="text-xs mb-2 mt-4" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Published to Community</p>
      {publishedLoading ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : myPublishedBackgrounds.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No published backgrounds yet.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {myPublishedBackgrounds.map((bg) => (
            <div key={bg.id} className="flex items-center gap-3" style={{
              padding: '8px 10px', background: 'var(--surface-1)', borderRadius: 8, border: '0.5px solid var(--border)',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: bg.type === 'gradient' ? bg.src : 'var(--surface-2)', overflow: 'hidden' }}>
                {bg.type !== 'gradient' && <img src={bg.src} alt={bg.name} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{bg.name || 'Untitled'}</p>
                <p className="text-[10px] uppercase text-muted-foreground">Public</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handleDeletePublished(bg.id)}
                  style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface-2)', border: '0.5px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gradient Modal */}
      {creatingGradient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-0 w-full max-w-sm rounded-xl border border-border shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Create Gradient</h3>
              <button onClick={() => setCreatingGradient(false)} className="opacity-50 hover:opacity-100 text-sm">Cancel</button>
            </div>
            
            <div className="w-full h-32 rounded-lg mb-4 shadow-inner border border-border" style={{ background: getGradientSrc() }} />
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold opacity-70 block mb-1">Name</label>
                <input type="text" value={gradName} onChange={e => setGradName(e.target.value)} className="w-full text-sm bg-surface-1 border border-border rounded px-3 py-2" placeholder="Gradient Name" />
              </div>
              
              <div>
                <label className="text-xs font-semibold opacity-70 block mb-1">Type</label>
                <select 
                  value={gradType} 
                  onChange={e => setGradType(e.target.value as any)} 
                  className="w-full text-sm bg-surface-1 border border-border rounded px-3 py-2"
                >
                  <option value="linear">Linear</option>
                  <option value="radial">Radial</option>
                  <option value="conic">Conic</option>
                </select>
              </div>

              {gradType !== 'radial' && (
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-semibold opacity-70 block">Angle</label>
                    <span className="text-xs font-mono opacity-50">{gradAngle}°</span>
                  </div>
                  <input type="range" min="0" max="360" value={gradAngle} onChange={e => setGradAngle(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer" style={{ background: 'var(--border)' }} />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold opacity-70 block mb-2">Colors</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {gradColors.map((color, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input 
                        type="color" 
                        value={color} 
                        onChange={e => {
                          const newColors = [...gradColors];
                          newColors[idx] = e.target.value;
                          setGradColors(newColors);
                        }} 
                        className="w-12 h-8 rounded cursor-pointer border border-border bg-surface-1 flex-shrink-0" 
                      />
                      <input
                        type="text"
                        value={color}
                        onChange={e => {
                          const newColors = [...gradColors];
                          newColors[idx] = e.target.value;
                          setGradColors(newColors);
                        }}
                        className="flex-1 text-sm bg-surface-1 border border-border rounded px-2 py-1 font-mono uppercase"
                      />
                      {gradColors.length > 2 && (
                        <button 
                          onClick={() => {
                            const newColors = gradColors.filter((_, i) => i !== idx);
                            setGradColors(newColors);
                          }}
                          className="p-1.5 rounded bg-surface-2 hover:bg-surface-3 border border-border text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={() => setGradColors([...gradColors, '#ffffff'])}
                  className="w-full py-2 mt-3 bg-surface-1 hover:bg-surface-2 border border-border text-sm rounded flex items-center justify-center gap-1 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Color
                </button>
              </div>
              
              <button 
                onClick={handleSaveGradient}
                disabled={uploading}
                className="w-full py-2.5 bg-black dark:bg-white text-white dark:text-black rounded font-medium text-sm mt-4 disabled:opacity-50"
              >
                {uploading ? 'Saving...' : 'Save Gradient Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

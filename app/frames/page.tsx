'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { isAdmin } from '@/hooks/useAdmin';
import { listUserFrames, deleteUserFrame, type UserFrame } from '@/lib/user-frames';
import {
  listPublicFrames,
  createPublicFrame,
  deletePublicFrame,
  publishUserFrame,
  type PublicFrame,
} from '@/lib/public-frames';
import type { Frame } from '@/lib/frames';
import { Button } from '@/components/ui/button';
import { useTheme, ThemeToggle } from '@/hooks/useTheme';
import { Pencil, Trash2, Plus, Globe, Upload } from 'lucide-react';

const EMPTY_FRAME: Omit<Frame, 'id'> = {
  name: 'Untitled Frame',
  description: '',
  photoCount: 4,
  layout: 'strip-4',
  aspectRatio: 4 / 3,
  color: '#f5f0e8',
  borderColor: '#1a1410',
  accentColor: '#c9a84c',
  emoji: '📷',
};

export default function FramesPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  const isUserAdmin = !loading && user && isAdmin(user.email);

  // User frames
  const [userFrames, setUserFrames] = useState<UserFrame[]>([]);
  const [userFramesLoading, setUserFramesLoading] = useState(true);

  // Public frames (admin only)
  const [publicFrames, setPublicFrames] = useState<PublicFrame[]>([]);
  const [publicFramesLoading, setPublicFramesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Load user frames
  useEffect(() => {
    if (!user) return;
    setUserFramesLoading(true);
    listUserFrames(user.uid)
      .then(setUserFrames)
      .catch(console.error)
      .finally(() => setUserFramesLoading(false));
  }, [user]);

  // Load public frames (admin)
  const refreshPublic = useCallback(async () => {
    if (!isUserAdmin) return;
    setPublicFramesLoading(true);
    try {
      setPublicFrames(await listPublicFrames());
    } catch (e) {
      console.error(e);
    }
    setPublicFramesLoading(false);
  }, [isUserAdmin]);

  useEffect(() => {
    if (isUserAdmin) refreshPublic();
  }, [isUserAdmin, refreshPublic]);

  const handleCreateNew = async () => {
    if (!user) return;
    router.push('/editor');
  };

  const handleDeleteUserFrame = async (id: string) => {
    if (!user || !confirm('Delete this frame? This cannot be undone.')) return;
    try {
      await deleteUserFrame(user.uid, id);
      setUserFrames((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      console.error(e);
      alert('Failed to delete frame.');
    }
  };

  const handlePublishFrame = async (frame: UserFrame) => {
    if (!user || !frame.name) {
      alert('Please give the frame a name before publishing.');
      return;
    }
    setPublishingId(frame.id);
    try {
      await publishUserFrame(user, { config: frame.config, name: frame.name });
      alert('Frame published to community!');
    } catch (e) {
      console.error(e);
      alert('Failed to publish frame.');
    }
    setPublishingId(null);
  };

  const handleDeletePublicFrame = async (id: string) => {
    if (!confirm('Delete this community frame?')) return;
    try {
      await deletePublicFrame(id);
      await refreshPublic();
    } catch (e) {
      console.error(e);
      alert('Failed to delete frame.');
    }
  };

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground text-sm">Loading...</p></main>;
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="flex items-center gap-2">
            <div className="flex items-center justify-center" style={{ width: 28, height: 28, background: 'var(--primary)', borderRadius: 4 }}>
              <span style={{ fontSize: 14 }}>🎨</span>
            </div>
            <span className="font-serif font-bold text-sm text-foreground">My Frames</span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button onClick={handleCreateNew} className="flex items-center gap-1.5">
            <Plus className="w-3 h-3" />
            New Frame
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-12">
        {/* User's Custom Frames */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-bold text-lg text-foreground">My Custom Frames</h2>
            </div>
          </div>
          
          {userFramesLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : userFrames.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg">
              <p className="text-muted-foreground mb-3">No custom frames yet</p>
              <Button onClick={() => router.push('/editor')} variant="outline" size="sm">
                <Plus className="w-3 h-3 mr-1" />
                Create Your First Frame
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userFrames.map((f) => (
                <div key={f.id} className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-foreground truncate">{f.name || 'Untitled'}</h3>
                        <p className="text-xs text-muted-foreground">
                          {f.config?.elements?.filter((e: any) => e.type === 'photo').length || 0} photos
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePublishFrame(f)}
                        disabled={publishingId === f.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs transition"
                        style={{ 
                          background: publishingId === f.id ? 'var(--text-muted)' : 'var(--brand)',
                          color: '#fff',
                        }}
                      >
                        {publishingId === f.id ? 'Publishing...' : 'Publish'}
                      </button>
                      <button
                        onClick={() => router.push(`/editor?id=${f.id}`)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs border border-border hover:bg-accent transition"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUserFrame(f.id)}
                        className="flex items-center justify-center p-1.5 rounded hover:bg-destructive/10 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Admin: Public Frames */}
        {isUserAdmin && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-bold text-lg text-foreground">Community Frames</h2>
              </div>
              <Button onClick={() => {}} variant="outline" size="sm" disabled>
                <Upload className="w-3 h-3 mr-1" />
                Create Public
              </Button>
            </div>

            {publicFramesLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : publicFrames.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No community frames yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicFrames.map((f) => (
                  <div key={f.id} className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{f.emoji}</span>
                            <h3 className="font-medium text-sm text-foreground truncate">{f.name || 'Untitled'}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{f.description || 'No description'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => router.push(`/editor?publicId=${f.id}`)}
                            className="p-1 rounded hover:bg-accent transition"
                            title="Edit"
                          >
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDeletePublicFrame(f.id)}
                            className="p-1 rounded hover:bg-destructive/10 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        <p>{f.photoCount} photos · {f.layout} · {f.active ? '✓ Active' : '⏸ Hidden'}</p>
                        {f.ownerName && <p className="mt-1">By: {f.ownerName}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

'use client';
import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { isAdmin } from '@/hooks/useAdmin';
import { deleteUserFrame, type UserFrame } from '@/lib/user-frames';
import { deletePublicFrame } from '@/lib/public-frames';
import {
  requestFramePublish,
  type PublishRequest,
} from '@/lib/publish-requests';
import { Button } from '@/components/ui/button';
import { useTheme, ThemeToggle } from '@/hooks/useTheme';
import { Pencil, Trash2, Plus, Globe } from 'lucide-react';
import { useStudioSettings } from '@/hooks/useStudioSettings';
import { useDialog } from '@/components/ui/dialog-provider';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePendingPublishRequests, usePublicFrames, useUserFrames, useUserPublishRequests } from '@/hooks/useFrames';

export default function FramesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useTheme();
  const { settings, isLoaded } = useStudioSettings();
  const { alert, confirm } = useDialog();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isLoaded && settings) {
      document.title = `Frames — ${settings.studioName}`;
    }
  }, [isLoaded, settings]);

  const isUserAdmin = !loading && user && isAdmin(user.email);

  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const { data: userFrames = [], mutate: mutateUserFrames, isLoading: userFramesLoading } = useUserFrames(user?.uid);
  const { data: publicFrames = [], mutate: mutatePublicFrames, isLoading: publicFramesLoading } = usePublicFrames(!!isUserAdmin);
  const { data: publishRequests = [], mutate: mutatePublishRequests } = useUserPublishRequests(user?.uid);
  const { data: pendingAdminRequests = [] } = usePendingPublishRequests(!!isUserAdmin);

  const pendingPublishRequests = useMemo(() => {
    const pendingMap: Record<string, PublishRequest> = {};
    publishRequests.forEach(req => {
      if (req.status === 'pending') pendingMap[req.frameId] = req;
    });
    return pendingMap;
  }, [publishRequests]);

  const pendingAdminRequestsCount = pendingAdminRequests.length;

  const handleCreateNew = async () => {
    if (!user) return;
    if (isMobile) {
      await alert('The Frame Editor is best experienced on a tablet or desktop. Please use a larger screen to create and edit frames.');
      return;
    }
    router.push('/editor');
  };

  const handleEditFrame = async (id: string) => {
    if (isMobile) {
      await alert('The Frame Editor is best experienced on a tablet or desktop. Please use a larger screen to create and edit frames.');
      return;
    }
    router.push(`/editor?id=${id}`);
  };

  const handleEditPublicFrame = async (id: string) => {
    if (isMobile) {
      await alert('The Frame Editor is best experienced on a tablet or desktop. Please use a larger screen to create and edit frames.');
      return;
    }
    router.push(`/editor?publicId=${id}`);
  };

  const handleDeleteUserFrame = async (id: string) => {
    if (!user) return;
    const isConfirmed = await confirm('Delete this frame? This cannot be undone.');
    if (!isConfirmed) return;
    try {
      await deleteUserFrame(user.uid, id);
      await mutateUserFrames((prev = []) => prev.filter((f) => f.id !== id), { revalidate: false });
    } catch (e) {
      console.error(e);
      await alert('Failed to delete frame.');
    }
  };

  const handlePublishFrame = async (frame: UserFrame) => {
    if (!user) return;
    if (!frame.name) {
      await alert('Please give the frame a name before publishing.');
      return;
    }
    setPublishingId(frame.id);
    try {
      await requestFramePublish(frame.id, user, { config: frame.config, name: frame.name });
      await alert('Publish request sent! An admin will review your frame.');
      await mutatePublishRequests((prev = []) => ([
        ...prev,
        {
          id: 'temp-id',
          frameId: frame.id,
          user: { uid: user.uid, displayName: user.displayName },
          frame: { config: frame.config, name: frame.name },
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date()
        } as PublishRequest,
      ]), { revalidate: true });
    } catch (e) {
      console.error(e);
      await alert('Failed to send publish request.');
    }
    setPublishingId(null);
  };

  const handleDeletePublicFrame = async (id: string) => {
    const isConfirmed = await confirm('Delete this community frame?');
    if (!isConfirmed) return;
    try {
      await deletePublicFrame(id);
      await mutatePublicFrames((prev = []) => prev.filter((f) => f.id !== id), { revalidate: true });
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
      <header className={`border-b border-border flex items-center justify-between ${isMobile ? 'px-3 py-3' : 'px-6 py-4'}`}>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/')} className="flex items-center gap-2">
            <div className="flex items-center justify-center" style={{ width: isMobile ? 24 : 28, height: isMobile ? 24 : 28, background: 'var(--primary)', borderRadius: 4 }}>
              <span style={{ fontSize: isMobile ? 12 : 14 }}>🎨</span>
            </div>
            <h1 className={`font-serif font-bold text-foreground m-0 ${isMobile ? 'text-xs' : 'text-sm'}`}>My Frames</h1>
          </button>
        </div>
        <div className="flex items-center" style={{ gap: isMobile ? 4 : 12 }}>
          <ThemeToggle />
          <Button onClick={handleCreateNew} className={`flex items-center gap-1.5 ${isMobile ? 'px-2 py-1 text-xs' : ''}`}>
            <Plus className={isMobile ? 'w-3 h-3' : 'w-3 h-3'} />
            {!isMobile && 'New Frame'}
          </Button>
        </div>
      </header>

      <div className={`max-w-6xl mx-auto space-y-12 ${isMobile ? 'px-3 py-4' : 'px-6 py-8'}`}>
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
              <Button onClick={handleCreateNew} variant="outline" size="sm">
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
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{f.emoji || '✨'}</span>
                          <h3 className="font-medium text-sm text-foreground truncate">{f.name || 'Untitled'}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {f.config?.elements?.filter((e: any) => e.type === 'photo').length || 0} photos
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {pendingPublishRequests[f.id] ? (
                        <div
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs transition"
                          style={{ 
                            background: 'var(--text-muted)',
                            color: '#fff',
                            cursor: 'default'
                          }}
                        >
                          Pending Review
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePublishFrame(f)}
                          disabled={publishingId === f.id}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs transition"
                          style={{ 
                            background: publishingId === f.id ? 'var(--text-muted)' : 'var(--brand)',
                            color: '#fff',
                          }}
                        >
                          {publishingId === f.id ? 'Requesting...' : 'Publish'}
                        </button>
                      )}
                      <button
                        onClick={() => handleEditFrame(f.id)}
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
              <Button onClick={() => router.push('/admin/reviews')} variant="outline" size="sm" className="relative">
                <Globe className="w-3 h-3 mr-1" />
                Review Requests
                {pendingAdminRequestsCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {pendingAdminRequestsCount}
                  </span>
                )}
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
                            onClick={() => handleEditPublicFrame(f.id)}
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

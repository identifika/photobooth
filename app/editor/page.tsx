'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadUserFrame, createUserFrame, updateUserFrame } from '@/lib/user-frames';
import { publishUserFrame, loadPublicFrame, updateAnyPublicFrame } from '@/lib/public-frames';
import { isAdmin } from '@/hooks/useAdmin';
import type { FrameConfig } from '@/lib/frame-types';
import FrameEditor from '@/components/FrameEditor';
import { Button } from '@/components/ui/button';
import { useTheme, ThemeToggle } from '@/hooks/useTheme';
import { Globe, Check, Loader2 } from 'lucide-react';

const EMPTY_CONFIG: FrameConfig = {
  width: 400,
  height: 600,
  color: '#f5f0e8',
  borderColor: '#1a1410',
  accentColor: '#c9a84c',
  accentSize: 4,
  elements: [],
};

export default function EditorPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground text-sm">Loading editor...</p></main>}>
      <EditorInner />
    </Suspense>
  );
}

function EditorInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const frameId = searchParams.get('id');
  const publicFrameId = searchParams.get('publicId');
  const { resolvedTheme } = useTheme();
  const isUserAdmin = user ? isAdmin(user.email) : false;

  const [config, setConfig] = useState<FrameConfig>(EMPTY_CONFIG);
  const [frameName, setFrameName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const isEdit = !!frameId;
  const isPublicEdit = !!publicFrameId;

  // redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  // load existing frame if editing
  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    
    // Load public frame
    if (publicFrameId) {
      loadPublicFrame(publicFrameId).then((frame) => {
        if (frame) {
          if (frame.config) setConfig(frame.config);
          setFrameName(frame.name);
          setCategoryId(frame.layout);
          setSortOrder(String(frame.sortOrder ?? 0));
        }
        setLoaded(true);
      });
      return;
    }
    
    // Load user frame
    if (frameId) {
      loadUserFrame(user.uid, frameId).then((frame) => {
        if (frame) {
          setConfig(frame.config);
          setFrameName(frame.name);
          setCategoryId(frame.categoryId);
        }
        setLoaded(true);
      });
      return;
    }
    
    setLoaded(true);
  }, [user, frameId, publicFrameId]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      const derivedPhotoCount = Math.max(1, config.elements?.filter((e) => e.type === 'photo').length || 4);
      const derivedLayout = derivedPhotoCount <= 2 ? 'strip-2' : derivedPhotoCount === 3 ? 'strip-3' : 'grid-2x2';

      // Save public frame (admin only)
      if (isPublicEdit && isUserAdmin) {
        await updateAnyPublicFrame(publicFrameId!, {
          config,
          name: frameName,
          layout: derivedLayout as any,
          sortOrder: parseInt(sortOrder) || 0,
          photoCount: derivedPhotoCount,
        });
      } else if (frameId) {
        // Save user frame
        await updateUserFrame(user.uid, frameId, { config, name: frameName, categoryId });
      } else {
        // Create new user frame
        const newId = await createUserFrame(user.uid, { config, name: frameName, categoryId });
        router.replace(`/editor?id=${newId}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save frame. Check console.');
    } finally {
      setSaving(false);
    }
  }, [user, frameId, publicFrameId, config, frameName, categoryId, sortOrder, isPublicEdit, isUserAdmin, router]);

  const handlePublish = useCallback(async () => {
    if (!user || !frameName.trim()) {
      alert('Please give your frame a name before publishing.');
      return;
    }
    setPublishing(true);
    try {
      // First ensure the frame is saved
      let currentFrameId = frameId;
      if (!currentFrameId) {
        currentFrameId = await createUserFrame(user.uid, { config, name: frameName, categoryId });
        router.replace(`/editor?id=${currentFrameId}`);
      } else {
        await updateUserFrame(user.uid, currentFrameId, { config, name: frameName, categoryId });
      }
      
      // Then publish to community
      await publishUserFrame(user, { config, name: frameName });
      setPublished(true);
      setTimeout(() => setPublished(false), 5000);
    } catch (err) {
      console.error('Publish failed:', err);
      alert('Failed to publish frame. Check console.');
    } finally {
      setPublishing(false);
    }
  }, [user, frameId, config, frameName, categoryId, router]);

  if (loading || !loaded) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading editor...</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex-none flex items-center justify-between px-6 py-3 border-b border-border">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 group">
          <div className="flex items-center justify-center" style={{ width: 28, height: 28, background: 'var(--primary)', borderRadius: 4 }}>
            <span style={{ fontSize: 14 }}>📷</span>
          </div>
          <span className="font-serif font-bold text-sm text-foreground">
            {isPublicEdit ? 'Edit Community Frame' : isEdit ? 'Edit My Frame' : 'New Frame'}
          </span>
        </button>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {saved && <span className="text-xs text-green-600 font-medium animate-fadeIn">✓ Saved</span>}
          <span className="text-xs text-muted-foreground">{user.displayName || user.email}</span>
          <img src={user.photoURL || ''} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
        </div>
      </header>

      {/* Editor fills remaining space */}
      <div className="flex-1 overflow-hidden h-full">
        <FrameEditor
          config={config}
          onChange={setConfig}
          frameName={frameName}
          onNameChange={setFrameName}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          categories={[]}
          onSave={handleSave}
          onCancel={() => router.push('/')}
          isEdit={isEdit}
        />
      </div>

      {/* Save button bar */}
      <div className="flex-none flex items-center justify-between px-6 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {isPublicEdit 
            ? 'Editing community frame — changes visible to all users' 
            : isEdit 
              ? 'Overwrites this frame in your collection' 
              : 'Creates a new frame in your collection'}
        </p>
        <div className="flex items-center gap-2">
          {isPublicEdit && isUserAdmin ? (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Update Community Frame'}
            </Button>
          ) : (
            <>
              {published ? (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1 animate-fadeIn">
                  <Check className="w-3 h-3" /> Published to community
                </span>
              ) : (
                <Button
                  variant="outline"
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex items-center gap-1.5"
                >
                  {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                  {publishing ? 'Publishing...' : 'Publish to Community'}
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : isEdit ? 'Update Frame' : 'Save New Frame'}
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
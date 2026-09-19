'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadUserFrame, createUserFrame, updateUserFrame } from '@/lib/user-frames';
import { loadPublicFrame, updateAnyPublicFrame } from '@/lib/public-frames';
import { requestFramePublish, listUserPublishRequests, type PublishRequest } from '@/lib/publish-requests';
import { isAdmin } from '@/hooks/useAdmin';
import type { FrameConfig } from '@/lib/frame-types';
import FrameEditor from '@/components/FrameEditor';
import { Button } from '@/components/ui/button';
import { useTheme, ThemeToggle } from '@/hooks/useTheme';
import { Globe, Check, Loader2, Sparkles } from 'lucide-react';
import { useStudioSettings } from '@/hooks/useStudioSettings';
import { useIsMobile } from '@/hooks/useIsMobile';

import { useDialog } from '@/components/ui/dialog-provider';
import { getGuestFrameDraft, saveGuestFrameDraft, clearGuestFrameDraft } from '@/lib/guest-frame';

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
  const { settings, isLoaded } = useStudioSettings();
  const { alert, confirm } = useDialog();
  const isUserAdmin = user ? isAdmin(user.email) : false;
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">🖥️</p>
          <h2 className="font-display text-xl font-bold mb-2">Desktop Recommended</h2>
          <p className="text-sm text-muted-foreground">The Frame Editor works best on a larger screen. Please use a tablet or desktop.</p>
        </div>
      </main>
    );
  }

  const [config, setConfig] = useState<FrameConfig>(EMPTY_CONFIG);
  const [frameName, setFrameName] = useState('');
  const [frameEmoji, setFrameEmoji] = useState('✨');

  useEffect(() => {
    if (isLoaded && settings) {
      document.title = `Editor — ${settings.studioName}`;
    }
  }, [isLoaded, settings]);
  const [categoryId, setCategoryId] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cachedLocally, setCachedLocally] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PublishRequest | null>(null);

  const isEdit = !!frameId;
  const isPublicEdit = !!publicFrameId;

  // Only redirect if attempting to edit a specific remote frame without logging in
  useEffect(() => {
    if (!loading && !user && (frameId || publicFrameId)) {
      router.replace(`/login?redirect=${encodeURIComponent(frameId ? `/editor?id=${frameId}` : `/editor?publicId=${publicFrameId}`)}`);
    }
  }, [user, loading, frameId, publicFrameId, router]);

  // load existing frame if editing or restore draft from browser cache
  useEffect(() => {
    // Load public frame
    if (publicFrameId) {
      if (!user) return;
      loadPublicFrame(publicFrameId).then((frame) => {
        if (frame) {
          if (frame.config) setConfig(frame.config);
          setFrameName(frame.name);
          setFrameEmoji(frame.emoji || '✨');
          setCategoryId(frame.layout);
          setSortOrder(String(frame.sortOrder ?? 0));
        }
        setLoaded(true);
      });
      return;
    }
    
    // Load user frame
    if (frameId) {
      if (!user) return;
      loadUserFrame(user.uid, frameId).then((frame) => {
        if (frame) {
          setConfig(frame.config);
          setFrameName(frame.name);
          setFrameEmoji(frame.emoji || '✨');
          setCategoryId(frame.categoryId);
        }
        setLoaded(true);
      });
      // Load pending requests
      listUserPublishRequests(user.uid).then((reqs) => {
        const pending = reqs.find(req => req.frameId === frameId && req.status === 'pending');
        if (pending) setPendingRequest(pending);
      });
      return;
    }
    
    // For new frames, restore cached draft if one exists in localStorage
    const draft = getGuestFrameDraft();
    if (draft) {
      setConfig(draft.config);
      setFrameName(draft.name);
      setFrameEmoji(draft.emoji || '✨');
      setCategoryId(draft.categoryId || '');
      setCachedLocally(true);
    }
    setLoaded(true);
  }, [user, frameId, publicFrameId]);

  // Auto-save draft in browser cache when editing a new frame (guest or user)
  useEffect(() => {
    if (!loaded) return;
    if (!frameId && !publicFrameId) {
      saveGuestFrameDraft({
        config,
        name: frameName,
        emoji: frameEmoji,
        categoryId,
      });
      setCachedLocally(true);
    }
  }, [config, frameName, frameEmoji, categoryId, frameId, publicFrameId, loaded]);

  const handleSave = useCallback(async () => {
    // Guest user must log in to save to account
    if (!user) {
      saveGuestFrameDraft({ config, name: frameName, emoji: frameEmoji, categoryId });
      setCachedLocally(true);
      const shouldLogin = await confirm(
        'Please sign in or create an account to save this frame to your profile.\n\nYour custom frame draft has been safely saved in this browser cache and will be restored when you return!'
      );
      if (shouldLogin) {
        router.push('/login?redirect=/editor');
      }
      return;
    }

    setSaving(true);
    setSaved(false);
    try {
      const derivedPhotoCount = Math.max(1, config.elements?.filter((e) => e.type === 'photo').length || 4);
      const derivedLayout = derivedPhotoCount <= 2 ? 'strip-2' : derivedPhotoCount === 3 ? 'strip-3' : 'grid-2x2';

      // Save public frame (admin only)
      if (isPublicEdit && isUserAdmin) {
        await updateAnyPublicFrame(user?.email || '', publicFrameId!, {
          config,
          name: frameName,
          layout: derivedLayout as any,
          sortOrder: parseInt(sortOrder) || 0,
          photoCount: derivedPhotoCount,
        });
      } else if (frameId) {
        // Save user frame
        await updateUserFrame(user.uid, frameId, { config, name: frameName, emoji: frameEmoji, categoryId });
      } else {
        // Create new user frame
        const newId = await createUserFrame(user.uid, { config, name: frameName, emoji: frameEmoji, categoryId });
        clearGuestFrameDraft();
        setCachedLocally(false);
        router.replace(`/editor?id=${newId}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      await alert('Failed to save frame. Check console.');
    } finally {
      setSaving(false);
    }
  }, [user, frameId, publicFrameId, config, frameName, frameEmoji, categoryId, sortOrder, isPublicEdit, isUserAdmin, router, alert, confirm]);

  const handlePublish = useCallback(async () => {
    if (!user) {
      saveGuestFrameDraft({ config, name: frameName, emoji: frameEmoji, categoryId });
      setCachedLocally(true);
      const shouldLogin = await confirm(
        'Please sign in or create an account to publish this frame to the community.\n\nYour custom frame draft has been safely saved in this browser cache!'
      );
      if (shouldLogin) {
        router.push('/login?redirect=/editor');
      }
      return;
    }

    if (!frameName.trim()) {
      await alert('Please give your frame a name before publishing.');
      return;
    }
    setPublishing(true);
    try {
      // First ensure the frame is saved
      let currentFrameId = frameId;
      if (!currentFrameId) {
        currentFrameId = await createUserFrame(user.uid, { config, name: frameName, emoji: frameEmoji, categoryId });
        clearGuestFrameDraft();
        setCachedLocally(false);
        router.replace(`/editor?id=${currentFrameId}`);
      } else {
        await updateUserFrame(user.uid, currentFrameId, { config, name: frameName, emoji: frameEmoji, categoryId });
      }
      
      // Then request publish to community
      await requestFramePublish(currentFrameId, user, { config, name: frameName });
      setPendingRequest({
        id: 'temp-id',
        frameId: currentFrameId,
        user: { uid: user.uid, displayName: user.displayName },
        frame: { config, name: frameName },
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      } as PublishRequest);
      setPublished(true);
      setTimeout(() => setPublished(false), 5000);
    } catch (err) {
      console.error('Publish failed:', err);
      await alert('Failed to send publish request. Check console.');
    } finally {
      setPublishing(false);
    }
  }, [user, frameId, config, frameName, frameEmoji, categoryId, router, alert, confirm]);

  const handleSaveAndUse = useCallback(async () => {
    const nameToUse = frameName.trim() || 'My Custom Frame';
    saveGuestFrameDraft({
      config,
      name: nameToUse,
      emoji: frameEmoji,
      categoryId,
    });
    setCachedLocally(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('use_guest_frame', 'true');
    }
    await alert('Your custom frame has been saved! Ready to use in the photobooth.');
    router.push('/?useGuestFrame=true');
  }, [config, frameName, frameEmoji, categoryId, alert, router]);

  if (loading || !loaded) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading editor...</p>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex-none flex items-center justify-between px-6 py-3 border-b border-border">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 group">
          <div className="flex items-center justify-center" style={{ width: 28, height: 28, background: 'var(--primary)', borderRadius: 4 }}>
            <span style={{ fontSize: 14 }}>📷</span>
          </div>
          <h1 className="font-serif font-bold text-sm text-foreground m-0">
            {isPublicEdit ? 'Edit Community Frame' : isEdit ? 'Edit My Frame' : 'New Frame'}
          </h1>
        </button>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {cachedLocally && !frameId && !publicFrameId && (
            <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full flex items-center gap-1 font-mono text-[11px]">
              💾 Draft cached in browser
            </span>
          )}
          {saved && <span className="text-xs text-green-600 font-medium animate-fadeIn">✓ Saved</span>}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{user.displayName || user.email}</span>
              {user.photoURL && <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">Guest</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/login?redirect=/editor')}
                className="text-xs h-7 px-2.5"
              >
                Sign in
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Editor fills remaining space */}
      <div className="flex-1 overflow-hidden h-full">
        <FrameEditor
          config={config}
          onChange={setConfig}
          frameName={frameName}
          onNameChange={setFrameName}
          frameEmoji={frameEmoji}
          onEmojiChange={setFrameEmoji}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          categories={[]}
          onSave={handleSave}
          onCancel={() => router.push('/')}
          onSaveAndUse={!user ? handleSaveAndUse : undefined}
          isEdit={isEdit}
        />
      </div>

      {/* Save button bar */}
      <div className="flex-none flex items-center justify-between px-6 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {!user
            ? 'Draft cached in browser — Tap "Save & Use" to shoot photos, or sign in to save permanently'
            : isPublicEdit 
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
              {!user && (
                <Button
                  onClick={handleSaveAndUse}
                  className="flex items-center gap-1.5 shadow-sm font-medium"
                  style={{ background: 'var(--brand)', color: '#fff' }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Save & Use
                </Button>
              )}
              {published ? (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1 animate-fadeIn">
                  <Check className="w-3 h-3" /> Publish request sent
                </span>
              ) : pendingRequest ? (
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  Pending admin review
                </span>
              ) : (
                <Button
                  variant="outline"
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex items-center gap-1.5"
                >
                  {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                  {publishing ? 'Requesting...' : 'Publish to Community'}
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving} variant={!user ? 'outline' : 'default'}>
                {saving ? 'Saving...' : isEdit ? 'Update Frame' : 'Save Frame'}
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
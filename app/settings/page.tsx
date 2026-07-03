'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useTheme, ThemeToggle } from '@/hooks/useTheme';
import { useStudioSettings } from '@/hooks/useStudioSettings';
import { isAdmin } from '@/hooks/useAdmin';
import { listUserFrames, deleteUserFrame, type UserFrame } from '@/lib/user-frames';
import { listPublicFramesByOwner, deletePublicFrameAsOwner, type PublicFrame } from '@/lib/public-frames';
import { requestFramePublish } from '@/lib/publish-requests';
import { Globe, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { useDialog } from '@/components/ui/dialog-provider';
import { useIsMobile } from '@/hooks/useIsMobile';
import { EmailAuthProvider, linkWithCredential } from 'firebase/auth';
import { useOwnerPublicFrames, useUserFrames } from '@/hooks/useFrames';

const EMOJI_OPTIONS = ['📷', '🎬', '📸', '🎞️', '✨', '💫', '🌟', '⭐️', '🎭', '🪩', '🎪', '🎨'];

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { settings, updateSettings, resetSettings, isLoaded } = useStudioSettings();
  const { alert, confirm } = useDialog();
  const isMobile = useIsMobile();

  const [studioName, setStudioName] = useState('');
  const [studioLogo, setStudioLogo] = useState('');
  const [tagline, setTagline] = useState('');
  const [saved, setSaved] = useState(false);

  // Set Password (for Google-only users)
  const hasPasswordProvider = user?.providerData?.some(p => p.providerId === 'password') ?? false;
  const hasGoogleProvider = user?.providerData?.some(p => p.providerId === 'google.com') ?? false;
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleSetPassword = async () => {
    if (!user || !newPassword || newPassword.length < 6) return;
    setPasswordLoading(true);
    setPasswordError('');
    setPasswordMsg('');
    try {
      const credential = EmailAuthProvider.credential(user.email!, newPassword);
      await linkWithCredential(user, credential);
      setPasswordMsg('Password set successfully! You can now sign in with email and password on the desktop app.');
      setNewPassword('');
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message.replace('Firebase: ', '') : 'Failed to set password');
    }
    setPasswordLoading(false);
  };

  const isAuthorized = user && isAdmin(user.email);

  // SWR hooks for frames data
  const { data: myPublishedFrames = [], isLoading: publishedFramesLoading, mutate: mutatePublishedFrames } = useOwnerPublicFrames(user?.uid);
  const { data: myCustomFrames = [], isLoading: customFramesLoading, mutate: mutateCustomFrames } = useUserFrames(user?.uid);
  const [publishingFrameId, setPublishingFrameId] = useState<string | null>(null);

  // Load settings into local state
  useEffect(() => {
    if (isLoaded) {
      setStudioName(settings.studioName);
      setStudioLogo(settings.studioLogo);
      setTagline(settings.tagline);
      document.title = `Settings — ${settings.studioName}`;
    }
  }, [isLoaded, settings]);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  const handleSave = () => {
    updateSettings({
      studioName: studioName || 'Photobooth',
      studioLogo,
      tagline,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetSettings();
    setStudioName('Photobooth');
    setStudioLogo('📷');
    setTagline('Capture the moment');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteFrame = async (frameId: string) => {
    if (!user) return;
    const isConfirmed = await confirm('Unpublish this frame? It will be removed from the community.');
    if (!isConfirmed) return;
    try {
      const deleted = await deletePublicFrameAsOwner(frameId, user.uid);
      if (deleted) {
        await mutatePublishedFrames((prev = []) => prev.filter((f) => f.id !== frameId), { revalidate: false });
      }
    } catch (err) {
      console.error(err);
      await alert('Failed to delete frame. Check console.');
    }
  };

  const handleDeleteCustomFrame = async (frameId: string) => {
    if (!user) return;
    const isConfirmed = await confirm('Delete this frame? This cannot be undone.');
    if (!isConfirmed) return;
    try {
      await deleteUserFrame(user.uid, frameId);
      await mutateCustomFrames((prev = []) => prev.filter((f) => f.id !== frameId), { revalidate: false });
    } catch (err) {
      console.error(err);
      await alert('Failed to delete frame. Check console.');
    }
  };

  const handlePublishFrame = async (frame: UserFrame) => {
    if (!user) return;
    if (!frame.name) {
      await alert('Please give the frame a name before publishing.');
      return;
    }
    setPublishingFrameId(frame.id);
    try {
      await requestFramePublish(frame.id, user, { config: frame.config, name: frame.name });
      await alert('Publish request sent! An admin will review your frame.');
    } catch (err) {
      console.error(err);
      await alert('Failed to send publish request. Check console.');
    }
    setPublishingFrameId(null);
  };

  if (loading || !isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--surface-2)', padding: isMobile ? '12px 12px' : '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/')} className="flex items-center gap-2">
            <div className="flex items-center justify-center" style={{ width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, background: 'var(--brand)', borderRadius: 8 }}>
              <span style={{ fontSize: isMobile ? 14 : 16 }}>{settings.studioLogo}</span>
            </div>
            <h1 className={`font-medium ${isMobile ? 'text-base' : 'text-lg'}`} style={{ color: 'var(--text-primary)', margin: 0 }}>Settings</h1>
          </button>
        </div>
        <div className="flex items-center" style={{ gap: isMobile ? 4 : 12 }}>
          <ThemeToggle />
          <button 
            onClick={() => router.push('/')} 
            className={`text-xs ${isMobile ? 'text-[11px]' : ''}`}
            style={{ color: 'var(--text-secondary)' }}
          >
            ← Back
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: isMobile ? '16px 12px' : '32px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          {/* Set Password — only for Google-only users */}
          {hasGoogleProvider && !hasPasswordProvider && (
            <section>
              <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>Set Password</h2>
              <div style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 24 }}>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  You signed in with Google. Set a password so you can also sign in on the desktop app.
                </p>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>New Password</label>
                    <input
                      type="password"
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={6}
                      style={{
                        width: '100%', height: 40, borderRadius: 8,
                        border: '0.5px solid var(--border-strong)',
                        background: 'var(--surface-2)',
                        color: 'var(--text-primary)',
                        padding: '0 12px', fontSize: 14, outline: 'none',
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSetPassword}
                    disabled={passwordLoading || newPassword.length < 6}
                    style={{
                      height: 40, padding: '0 20px', borderRadius: 8,
                      background: 'var(--brand)', border: 'none', color: '#fff',
                      fontSize: 14, fontWeight: 600, cursor: 'pointer',
                      opacity: passwordLoading || newPassword.length < 6 ? 0.6 : 1,
                    }}
                  >
                    {passwordLoading ? 'Saving...' : 'Set Password'}
                  </button>
                </div>
                {passwordMsg && (
                  <p style={{ fontSize: 13, color: 'var(--text-accent)', marginTop: 12 }}>{passwordMsg}</p>
                )}
                {passwordError && (
                  <p style={{ fontSize: 13, color: 'var(--text-accent)', marginTop: 12 }}>{passwordError}</p>
                )}
              </div>
            </section>
          )}

          {/* Studio Branding Section - ADMIN ONLY */}
          {isAuthorized && (
            <section>
              <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>Studio Branding</h2>
              <div style={{ 
                background: 'var(--surface-2)', 
                border: '0.5px solid var(--border)', 
                borderRadius: 12, 
                padding: 24,
                display: 'flex', 
                flexDirection: 'column', 
                gap: 24 
              }}>
                {/* Logo Preview */}
                <div className="flex items-center gap-4">
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 64, height: 64,
                      background: 'var(--brand)',
                      borderRadius: 12,
                      fontSize: 32,
                    }}
                  >
                    {studioLogo || '📷'}
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{studioName || 'Photobooth'}</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tagline || 'Capture the moment'}</p>
                  </div>
                </div>

                {/* Logo Emoji Picker */}
                <div>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Logo (Emoji)</label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setStudioLogo(emoji)}
                        className="flex items-center justify-center text-xl"
                        style={{
                          width: 40, height: 40,
                          border: `0.5px solid ${studioLogo === emoji ? 'var(--brand)' : 'var(--border)'}`,
                          borderRadius: 8,
                          background: studioLogo === emoji ? 'var(--bg-accent)' : 'var(--surface-2)',
                          cursor: 'pointer',
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Studio Name */}
                <div>
                  <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Studio Name</label>
                  <input
                    value={studioName}
                    onChange={(e) => setStudioName(e.target.value)}
                    placeholder="Photobooth"
                    style={{
                      width: '100%', height: 40, borderRadius: 8,
                      border: '0.5px solid var(--border-strong)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-primary)',
                      padding: '0 12px',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Tagline */}
                <div>
                  <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Tagline</label>
                  <input
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Capture the moment"
                    style={{
                      width: '100%', height: 40, borderRadius: 8,
                      border: '0.5px solid var(--border-strong)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-primary)',
                      padding: '0 12px',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Appearance Section - ALL USERS */}
          <section>
            <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>Appearance</h2>
            <div style={{ 
              background: 'var(--surface-2)', 
              border: '0.5px solid var(--border)', 
              borderRadius: 12, 
              padding: 24 
            }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Theme</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Choose your preferred color scheme</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn"
                    style={{
                      height: 32, padding: '0 12px',
                      background: resolvedTheme === 'light' ? 'var(--brand)' : 'var(--surface-2)',
                      color: resolvedTheme === 'light' ? '#fff' : 'var(--text-primary)',
                      border: `0.5px solid ${resolvedTheme === 'light' ? 'transparent' : 'var(--border-strong)'}`,
                    }}
                    onClick={() => document.documentElement.classList.remove('dark')}
                  >
                    Light
                  </button>
                  <button
                    className="btn"
                    style={{
                      height: 32, padding: '0 12px',
                      background: resolvedTheme === 'dark' ? 'var(--brand)' : 'var(--surface-2)',
                      color: resolvedTheme === 'dark' ? '#fff' : 'var(--text-primary)',
                      border: `0.5px solid ${resolvedTheme === 'dark' ? 'transparent' : 'var(--border-strong)'}`,
                    }}
                    onClick={() => document.documentElement.classList.add('dark')}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* My Custom Frames Section - ALL USERS */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
                <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>My Custom Frames</h2>
              </div>
              <button
                onClick={() => router.push('/editor')}
                className="btn primary"
                style={{ height: 32, padding: '0 12px', fontSize: 13 }}
              >
                + New Frame
              </button>
            </div>
            <div style={{ 
              background: 'var(--surface-2)', 
              border: '0.5px solid var(--border)', 
              borderRadius: 12, 
              padding: 24 
            }}>
              {customFramesLoading ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
              ) : myCustomFrames.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    You haven't created any custom frames yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myCustomFrames.map((f) => (
                    <div key={f.id} className="flex items-center gap-3" style={{ 
                      padding: 12,
                      background: 'var(--surface-1)',
                      borderRadius: 8,
                      border: '0.5px solid var(--border)',
                    }}>
                      <span className="text-lg">🎨</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{f.name || 'Untitled'}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                          {f.config?.elements?.filter((e: any) => e.type === 'photo').length || 0} photos
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handlePublishFrame(f)}
                          disabled={publishingFrameId === f.id}
                          className="flex items-center justify-center gap-1 px-2"
                          style={{ 
                            height: 28, borderRadius: 6,
                            background: publishingFrameId === f.id ? 'var(--text-muted)' : 'var(--brand)',
                            color: '#fff',
                            fontSize: 11,
                            opacity: publishingFrameId === f.id ? 0.7 : 1,
                          }}
                          title="Publish to community"
                        >
                          {publishingFrameId === f.id ? 'Publishing...' : 'Publish'}
                        </button>
                        <button
                          onClick={() => router.push(`/editor?id=${f.id}`)}
                          className="flex items-center justify-center gap-1 px-2"
                          style={{ 
                            height: 28, borderRadius: 6,
                            background: 'var(--surface-2)',
                            border: '0.5px solid var(--border)',
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                          }}
                          title="Edit in visual editor"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCustomFrame(f.id)}
                          className="flex items-center justify-center"
                          style={{ 
                            width: 28, height: 28, borderRadius: 6,
                            background: 'var(--surface-2)',
                            border: '0.5px solid var(--border)',
                          }}
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* My Published Frames Section - ALL USERS */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
              <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>My Published Frames</h2>
            </div>
            <div style={{ 
              background: 'var(--surface-2)', 
              border: '0.5px solid var(--border)', 
              borderRadius: 12, 
              padding: 24 
            }}>
              {publishedFramesLoading ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
              ) : myPublishedFrames.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    You haven't published any frames yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myPublishedFrames.map((f) => (
                    <div key={f.id} className="flex items-center gap-3" style={{ 
                      padding: 12,
                      background: 'var(--surface-1)',
                      borderRadius: 8,
                      border: '0.5px solid var(--border)',
                    }}>
                      <span className="text-lg">{f.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{f.name}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{f.description}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => router.push(`/editor?publicId=${f.id}`)}
                          className="flex items-center justify-center gap-1 px-2"
                          style={{ 
                            height: 28, borderRadius: 6,
                            background: 'var(--surface-2)',
                            border: '0.5px solid var(--border)',
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                          }}
                          title="Edit in visual editor"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteFrame(f.id)}
                          className="flex items-center justify-center"
                          style={{ 
                            width: 28, height: 28, borderRadius: 6,
                            background: 'var(--surface-2)',
                            border: '0.5px solid var(--border)',
                          }}
                          title="Unpublish"
                        >
                          <Trash2 className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Account Section - ALL USERS */}
          <section>
            <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>Account</h2>
            <div style={{ 
              background: 'var(--surface-2)', 
              border: '0.5px solid var(--border)', 
              borderRadius: 12, 
              padding: 24 
            }}>
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'var(--bg-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600,
                    color: 'var(--text-accent)',
                  }}>
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{user.displayName || 'User'}</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user.email}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Actions - ADMIN ONLY */}
          {isAuthorized && (
            <div className="flex items-center justify-between pt-4">
              <button 
                className="btn" 
                onClick={handleReset}
                style={{ border: '0.5px solid var(--border-strong)' }}
              >
                Reset to Default
              </button>
              <div className="flex items-center gap-3">
                {saved && (
                  <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-success)' }}>
                    ✓ Saved
                  </span>
                )}
                <button className="btn primary" onClick={handleSave}>
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Version Info */}
      <div className="mt-8 text-center pb-8">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {studioName || 'Photobooth'} v{process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'}
        </p>
      </div>
    </main>
  );
}
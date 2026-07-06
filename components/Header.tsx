'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/hooks/useAdmin';
import { ThemeToggle } from '@/hooks/useTheme';
import { useStudioSettings } from '@/hooks/useStudioSettings';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePendingPublishRequests } from '@/hooks/useFrames';

export interface Step {
  id: string;
  label: string;
}

interface HeaderProps {
  steps?: Step[];
  currentStepIndex?: number;
  onRestart?: () => void;
  rightContent?: React.ReactNode;
}

export default function Header({ steps, currentStepIndex, onRestart, rightContent }: HeaderProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { settings, isLoaded } = useStudioSettings();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isGuest, setIsGuest] = useState<boolean | null>(null);

  const isAuthorized = user && isAdmin(user?.email);
  const { data: pendingAdminRequests = [] } = usePendingPublishRequests(!!isAuthorized);
  const pendingAdminRequestsCount = pendingAdminRequests.length;

  useEffect(() => {
    setIsGuest(sessionStorage.getItem('guest') === 'true');
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-user-menu]')) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showUserMenu]);

  const handleRestart = () => {
    if (onRestart) {
      onRestart();
    } else {
      router.push('/');
    }
  };

  const studioName = isLoaded ? settings?.studioName || 'PikaBooth' : '...';
  const tagline = isLoaded ? settings?.tagline || 'Open Source Photo Booth' : '...';
  const studioLogo = isLoaded ? settings?.studioLogo || '📷' : '...';

  return (
    <header className="sticky top-0 z-20" style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--surface-2)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '0 12px' : '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: isMobile ? 56 : 64, gap: isMobile ? 8 : 16 }}>

        {/* Logo */}
        <button onClick={handleRestart} className="flex items-center gap-2 group" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <div className="flex items-center justify-center group-hover:rotate-12 transition-transform"
            style={{ width: isMobile ? 32 : 38, height: isMobile ? 32 : 38, borderRadius: isMobile ? 8 : 10, background: 'var(--brand)', fontSize: isMobile ? 16 : 18 }}>
            {studioLogo}
          </div>
          <div className={isMobile ? 'hidden sm:block' : ''}>
            <h1 style={{ fontSize: isMobile ? 15 : 17, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.3px', margin: 0 }}>{studioName}</h1>
            {!isMobile && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 3 }}>{tagline}</div>}
          </div>
        </button>

        {/* Film strip step indicator */}
        {steps && currentStepIndex !== undefined && (
          <nav className="hidden md:flex items-center" aria-label="Session steps">
            {steps.map((s, i) => {
              const isActive = i === currentStepIndex;
              const isPast = i < currentStepIndex;
              return (
                <div key={s.id} className="flex items-center">
                  <div className={`film-cell ${isActive ? 'is-active' : ''} ${isPast ? 'is-past' : ''}`}>
                    <div className="film-frame"><span>{String(i + 1).padStart(2, '0')}</span></div>
                    <div className="film-label">{s.label}</div>
                  </div>
                  {i < steps.length - 1 && <div className="film-connector" />}
                </div>
              );
            })}
          </nav>
        )}

        {/* Header actions */}
        <div className="flex items-center" style={{ flexShrink: 0, gap: isMobile ? 4 : 8 }}>
          <ThemeToggle />
          
          {rightContent ? (
            rightContent
          ) : (
            <>
              <button className={`btn ghost ${isMobile ? '!px-2 !py-1 !text-xs' : ''}`} onClick={() => router.push('/date')}>
                {isMobile ? '💕' : 'Date Mode'}
              </button>
              {!isGuest && (
                <button className="btn primary" onClick={() => {
                  if (isMobile) {
                    alert('The Frame Editor is best experienced on a tablet or desktop. Please use a larger screen to create and edit frames.');
                  } else {
                    router.push('/editor');
                  }
                }}>
                  <span style={{ fontSize: 14 }}>+</span>
                  <span className="hidden sm:inline">New frame</span>
                </button>
              )}
              {/* User dropdown */}
              <div className="relative" data-user-menu>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--bg-accent)', border: '0.5px solid var(--border-strong)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600, color: 'var(--text-accent)',
                    flexShrink: 0,
                  }}
                >
                  {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'G'}
                  {pendingAdminRequestsCount > 0 && (
                    <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, background: 'red', borderRadius: '50%', border: '1px solid var(--surface-2)' }} />
                  )}
                </button>
                {showUserMenu && (
                  <div style={{
                    position: 'absolute', right: 0, top: 36, width: 220,
                    background: 'var(--surface-2)', border: '0.5px solid var(--border)',
                    borderRadius: 10, padding: '8px 0', boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                    zIndex: 50,
                  }}>
                    <div style={{ padding: '8px 14px', borderBottom: '0.5px solid var(--border)' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{user?.displayName || 'Guest'}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user?.email || 'Not logged in'}</p>
                    </div>
                    {!isGuest && (
                      <>
                        <button
                          onClick={() => { setShowUserMenu(false); router.push('/frames'); }}
                          style={{ width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 13, color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                          className="hover:bg-[var(--surface-1)]"
                        >
                          My Frames
                        </button>
                        <button
                          onClick={() => { setShowUserMenu(false); router.push('/filters'); }}
                          style={{ width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 13, color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                          className="hover:bg-[var(--surface-1)]"
                        >
                          My Filters
                        </button>
                        <button
                          onClick={() => { setShowUserMenu(false); router.push('/settings'); }}
                          style={{ width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 13, color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                          className="hover:bg-[var(--surface-1)]"
                        >
                          Settings
                        </button>
                        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                      </>
                    )}
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        if (isGuest) {
                          sessionStorage.removeItem('guest');
                          setIsGuest(false);
                          router.push('/login');
                        } else {
                          signOut();
                        }
                      }}
                      style={{ width: '100%', textAlign: 'left', padding: '7px 14px', fontSize: 13, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      className="hover:bg-[var(--surface-1)]"
                    >
                      {isGuest ? 'Sign in' : 'Sign out'}
                    </button>
                    <div style={{ padding: '8px 14px 4px 14px', borderTop: '0.5px solid var(--border)' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        v{process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

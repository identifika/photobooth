'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useStudioSettings } from '@/hooks/useStudioSettings';

export default function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const { settings, isLoaded } = useStudioSettings();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [user, loading, router]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message.replace('Firebase: ', ''));
    }
    setSubmitting(false);
  };

  const studioName = settings?.studioName || 'Photobooth';
  const studioLogo = settings?.studioLogo || '📷';
  const tagline = settings?.tagline || 'Capture the moment';

  useEffect(() => {
    if (isLoaded) {
      document.title = `Login — ${studioName}`;
    }
  }, [studioName, isLoaded]);

  if (loading || !isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </main>
    );
  }

  if (user) return null;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo & Branding */}
        <div className="text-center mb-8 animate-fadeIn">
          <div
            className="mx-auto mb-5 flex items-center justify-center"
            style={{ width: 72, height: 72, background: 'var(--brand)', borderRadius: 12, fontSize: 32 }}
          >
            {studioLogo}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>{studioName}</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{tagline}</p>
        </div>

        {/* Login Card */}
        <div style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <h2 className="font-medium text-lg text-center mb-5" style={{ color: 'var(--text-primary)' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>

          {/* Email/Password form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%', height: 40, borderRadius: 8,
                  border: '0.5px solid var(--border-strong)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-primary)',
                  padding: '0 12px', fontSize: 14, outline: 'none',
                }}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Password</label>
              <input
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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

            {error && (
              <div style={{ background: 'var(--bg-accent)', border: '0.5px solid var(--border-accent)', borderRadius: 8, padding: '8px 12px' }}>
                <p className="text-xs" style={{ color: 'var(--text-accent)' }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full"
              style={{
                height: 40, borderRadius: 8,
                background: 'var(--brand)', border: 'none', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="text-center mt-5">
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span style={{ fontWeight: 600, color: 'var(--brand)' }}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-5">
            <div style={{ flex: 1, height: 0.5, background: 'var(--border)' }} />
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>or</span>
            <div style={{ flex: 1, height: 0.5, background: 'var(--border)' }} />
          </div>

          {/* Google sign-in */}
          <button
            onClick={signInWithGoogle}
            style={{
              width: '100%', height: 40, borderRadius: 8,
              border: '0.5px solid var(--border-strong)',
              background: 'var(--surface-2)',
              color: 'var(--text-primary)',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Guest sign-in */}
          <button
            onClick={() => {
              sessionStorage.setItem('guest', 'true');
              router.push('/');
            }}
            style={{
              width: '100%', height: 40, borderRadius: 8,
              border: '0.5px solid var(--border-strong)',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 12,
            }}
            className="hover:bg-[var(--surface-1)] transition-colors"
          >
            Continue as Guest
          </button>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          By continuing, you agree to our{' '}
          <a href="/terms" className="hover:underline" style={{ color: 'var(--text-primary)' }}>Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" className="hover:underline" style={{ color: 'var(--text-primary)' }}>Privacy Policy</a>
        </p>

        {/* Version Info */}
        <p className="text-center mt-6 text-[10px]" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
          {studioName || 'Photobooth'} v{process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'}
        </p>
      </div>
    </main>
  );
}

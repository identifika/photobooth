'use client';
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { setClientSessionToken, getClientAuthToken } from '@/lib/auth-client';
import { getApiUrl } from '@/lib/api-config';

export interface AuthUser {
  id: string;
  uid: string;
  email: string | null;
  name: string | null;
  displayName: string | null;
  photoURL?: string | null;
  hasPassword?: boolean;
  hasGoogle?: boolean;
  isAdmin?: boolean;
  providerData?: Array<{ providerId: string }>;
  getIdToken?: () => Promise<string>;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
});

function toAuthUser(u: any): AuthUser {
  const id = u.id || u.uid || '';
  const email = u.email || null;
  const name = u.name || u.displayName || (email ? email.split('@')[0] : 'User');
  const providers: Array<{ providerId: string }> = [];
  if (u.hasPassword) providers.push({ providerId: 'password' });
  if (u.hasGoogle) providers.push({ providerId: 'google.com' });
  if (providers.length === 0) providers.push({ providerId: 'password' });

  return {
    id,
    uid: id,
    email,
    name,
    displayName: name,
    photoURL: u.photoURL || null,
    hasPassword: u.hasPassword ?? true,
    hasGoogle: u.hasGoogle ?? false,
    isAdmin: !!u.isAdmin,
    providerData: providers,
    getIdToken: async () => {
      const t = await getClientAuthToken();
      return t || '';
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; user: any }>('/api/auth/me');
      if (res?.user) {
        setUser(toAuthUser(res.user));
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const signInWithGoogle = async () => {
    const redirectPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
    const googleUrl = getApiUrl(`/api/auth/google?redirect=${encodeURIComponent(redirectPath)}`);
    if (typeof window !== 'undefined') {
      window.location.href = googleUrl;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    const res = await apiFetch<{ success: boolean; token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      json: { email, password },
    });
    if (res.token) {
      setClientSessionToken(res.token);
    }
    setUser(toAuthUser(res.user));
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const res = await apiFetch<{ success: boolean; token: string; user: any }>('/api/auth/signup', {
      method: 'POST',
      json: { email, password },
    });
    if (res.token) {
      setClientSessionToken(res.token);
    }
    setUser(toAuthUser(res.user));
  };

  const signOut = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout error:', err);
    }
    setClientSessionToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

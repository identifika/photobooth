'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword as webSignInEmail,
  createUserWithEmailAndPassword as webSignUpEmail,
  signOut as fbSignOut,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

const IS_NATIVE = typeof window !== 'undefined' && ('Capacitor' in window);

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
});

// Convert native plugin user to a minimal User-compatible object
function toUserCompat(u: Record<string, any> | null): User | null {
  if (!u?.uid) return null;
  return {
    uid: u.uid,
    email: u.email ?? null,
    displayName: u.displayName ?? null,
    photoURL: u.photoURL ?? null,
    emailVerified: u.emailVerified ?? false,
    providerData: [],
    metadata: {},
    isAnonymous: false,
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({}),
  } as unknown as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false); // Don't block UI

    if (IS_NATIVE) {
      // Native: listen via Capacitor plugin
      let listener: any;
      (async () => {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');

        // Check if already signed in
        try {
          const result = await FirebaseAuthentication.getCurrentUser();
          if (result.user) setUser(toUserCompat(result.user as any));
        } catch (_e) { /* no user */ }

        // Listen for changes
        listener = await FirebaseAuthentication.addListener('authStateChange', (event) => {
          setUser(toUserCompat(event.user));
        });
      })();

      return () => { listener?.remove(); };
    } else {
      // Web: listen via Firebase JS SDK
      if (!auth) return;
      const unsub = onAuthStateChanged(auth, (u) => setUser(u), (err) => {
        console.error('Auth state error:', err);
      });
      return () => unsub();
    }
  }, []);

  const signInWithGoogle = async () => {
    if (IS_NATIVE) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.signInWithGoogle();
      setUser(toUserCompat(result.user));
    } else {
      await signInWithPopup(auth, googleProvider);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (IS_NATIVE) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.signInWithEmailAndPassword({ email, password });
      setUser(toUserCompat(result.user));
    } else {
      await webSignInEmail(auth, email, password);
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (IS_NATIVE) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.createUserWithEmailAndPassword({ email, password });
      setUser(toUserCompat(result.user));
    } else {
      await webSignUpEmail(auth, email, password);
    }
  };

  const signOut = async () => {
    if (IS_NATIVE) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      await FirebaseAuthentication.signOut();
      setUser(null);
    } else {
      await fbSignOut(auth);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

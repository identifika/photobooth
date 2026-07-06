import { auth } from './firebase';

export async function getClientAuthToken(): Promise<string | null> {
  const IS_NATIVE = typeof window !== 'undefined' && ('Capacitor' in window);
  if (IS_NATIVE) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.getIdToken();
      return result.token || null;
    } catch {
      return null;
    }
  } else {
    try {
      return (await auth?.currentUser?.getIdToken()) || null;
    } catch {
      return null;
    }
  }
}

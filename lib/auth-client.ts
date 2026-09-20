import { auth } from './firebase';
import { Capacitor } from '@capacitor/core';

export async function getClientAuthToken(): Promise<string | null> {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  if (isNative) {
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

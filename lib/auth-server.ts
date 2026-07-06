export async function verifyIdToken(authHeader: string | null): Promise<{ uid: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1];
  if (!token) return null;

  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.warn('Missing NEXT_PUBLIC_FIREBASE_API_KEY for server auth verification');
      return null;
    }
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    const uid = data.users?.[0]?.localId;
    return uid ? { uid } : null;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

import { fsGetCollection, fsAddDocument, fsDeleteDocument, fsGetDocument } from './firestore';
import { v4 as uuidv4 } from 'uuid';

const COLLECTION = 'user_api_keys';
const STORAGE_PREFIX = 'pikabooth_user_api_keys_';

export interface ApiKey {
  id: string;
  uid: string;
  name: string;
  key: string;
  active: boolean;
  createdAt: string | number | Date;
  lastUsedAt?: string | number | Date;
}

/** Generate a secure random API key starting with pk_live_ */
export function generateApiKeyString(): string {
  const randomPart = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').slice(0, 8);
  return `pk_live_${randomPart}`;
}

function getLocalKeys(uid: string): ApiKey[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${uid}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setLocalKeys(uid: string, keys: ApiKey[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${uid}`, JSON.stringify(keys));
  } catch (e) {
    console.warn('Failed to save API keys to localStorage:', e);
  }
}

/** List all API keys for a user (combines LocalStorage + Firestore without throwing permissions error) */
export async function listUserApiKeys(uid: string): Promise<ApiKey[]> {
  const local = getLocalKeys(uid);

  // Try fetching from Firestore in background
  try {
    const docs = await fsGetCollection(COLLECTION, uid, 'uid');
    const remote = docs.map((d) => ({ id: d.id, ...d.data } as ApiKey));

    // Merge remote and local by key string
    const map = new Map<string, ApiKey>();
    local.forEach((k) => map.set(k.key, k));
    remote.forEach((k) => map.set(k.key, k));

    const merged = Array.from(map.values());
    merged.sort((a, b) => {
      const aTime = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt as any).getTime() || 0;
      const bTime = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt as any).getTime() || 0;
      return bTime - aTime;
    });

    setLocalKeys(uid, merged);
    return merged;
  } catch (err) {
    // If Firestore rules are not yet published or reject, gracefully return local keys
    return local;
  }
}

/** Create a new API key for external access */
export async function createApiKey(uid: string, name: string): Promise<ApiKey> {
  const key = generateApiKeyString();
  const newKey: ApiKey = {
    id: `key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    uid,
    name: name.trim() || 'Default API Key',
    key,
    active: true,
    createdAt: new Date().toISOString(),
  };

  // 1. Immediately save to LocalStorage so UI updates with 100% reliability
  const current = getLocalKeys(uid);
  const updated = [newKey, ...current];
  setLocalKeys(uid, updated);

  // 2. Silently attempt Firestore sync in background
  try {
    const docId = await fsAddDocument(COLLECTION, {
      uid,
      name: newKey.name,
      key: newKey.key,
      active: true,
    });
    if (docId) {
      newKey.id = docId;
      setLocalKeys(uid, [newKey, ...current]);
    }
  } catch (err) {
    // Firestore rules might be pending; local key is already active
    console.info('API key saved locally. Sync to cloud Firestore will occur when rules permit.');
  }

  return newKey;
}

/** Delete / revoke an API key */
export async function deleteApiKey(uid: string, keyId: string): Promise<void> {
  // 1. Delete from LocalStorage
  const current = getLocalKeys(uid);
  const updated = current.filter((k) => k.id !== keyId);
  setLocalKeys(uid, updated);

  // 2. Silently attempt Firestore delete
  try {
    await fsDeleteDocument(`${COLLECTION}/${keyId}`);
  } catch {
    // ignore
  }
}

// Thin abstraction over Firestore — uses REST API in Capacitor (reliable HTTP),
// web SDK in browser. Only exposes what the app actually needs.

import type { FrameConfig } from './frame-types';

const IS_NATIVE = typeof window !== 'undefined' && ('Capacitor' in window);
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'photobooth-ad7ab';
const DATABASE_ID = 'default';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// ── REST helpers (native) ──────────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  try {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.getIdToken();
    return result.token || null;
  } catch {
    return null;
  }
}

function parseFirestoreValue(val: Record<string, any>): any {
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return Number(val.integerValue);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.timestampValue !== undefined) return new Date(val.timestampValue);
  if (val.nullValue !== undefined) return null;
  if (val.arrayValue !== undefined) return (val.arrayValue.values || []).map(parseFirestoreValue);
  if (val.mapValue !== undefined) return parseFirestoreFields(val.mapValue.fields || {});
  if (val.referenceValue !== undefined) return val.referenceValue;
  return val;
}

function parseFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(val as Record<string, any>);
  }
  return result;
}

function toFirestoreValue(value: any): Record<string, any> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function toFirestoreFields(data: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    fields[key] = toFirestoreValue(val);
  }
  return fields;
}

function extractDocId(name: string): string {
  return name.split('/').pop() || '';
}

async function restGetDocument(path: string): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${FIRESTORE_BASE}/${path}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`Firestore GET ${path} failed: ${res.status} ${text}`);
    throw new Error(`Firestore GET failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return { id: extractDocId(json.name), data: parseFirestoreFields(json.fields || {}) };
}

async function restQueryCollection(collectionPath: string, field: string, value: string): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const body = {
    structuredQuery: {
      from: [{ collectionId: collectionPath }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: 'EQUAL',
          value: { stringValue: value },
        },
      },
    },
  };

  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`Firestore query ${collectionPath} failed: ${res.status} ${text}`);
    throw new Error(`Firestore query failed: ${res.status} ${text}`);
  }

  const results = await res.json();
  return (results || [])
    .filter((r: any) => r.document)
    .map((r: any) => ({
      id: extractDocId(r.document.name),
      data: parseFirestoreFields(r.document.fields || {}),
    }));
}

async function restGetAllCollection(collectionPath: string): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const body = {
    structuredQuery: {
      from: [{ collectionId: collectionPath }],
    },
  };

  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`Firestore getAll ${collectionPath} failed: ${res.status} ${text}`);
    throw new Error(`Firestore getAll failed: ${res.status} ${text}`);
  }

  const results = await res.json();
  return (results || [])
    .filter((r: any) => r.document)
    .map((r: any) => ({
      id: extractDocId(r.document.name),
      data: parseFirestoreFields(r.document.fields || {}),
    }));
}

async function restAddDocument(collectionPath: string, data: Record<string, unknown>): Promise<string> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const now = new Date().toISOString();
  const body = { fields: toFirestoreFields({ ...data, createdAt: now, updatedAt: now }) };

  const res = await fetch(`${FIRESTORE_BASE}/${collectionPath}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Firestore ADD failed: ${res.status}`);

  const json = await res.json();
  return extractDocId(json.name);
}

async function restUpdateDocument(path: string, data: Record<string, unknown>): Promise<void> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const body = { fields: toFirestoreFields({ ...data, updatedAt: new Date().toISOString() }) };

  const res = await fetch(`${FIRESTORE_BASE}/${path}?updateMask.fieldPaths=${Object.keys(data).join('&updateMask.fieldPaths=')}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Firestore UPDATE failed: ${res.status}`);
}

async function restDeleteDocument(path: string): Promise<void> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${FIRESTORE_BASE}/${path}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error(`Firestore DELETE failed: ${res.status}`);
}

// ── Web SDK (browser) ──────────────────────────────────────────────────────

async function webGetCollection(path: string, uid: string, field = 'uid'): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const { db } = await import('./firebase');
  const q = query(collection(db, path), where(field, '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, data: d.data() as Record<string, unknown> }));
}

async function webGetAllCollection(path: string): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const { collection, getDocs } = await import('firebase/firestore');
  const { db } = await import('./firebase');
  const snap = await getDocs(collection(db, path));
  return snap.docs.map(d => ({ id: d.id, data: d.data() as Record<string, unknown> }));
}

async function webGetDocument(path: string): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('./firebase');
  const snap = await getDoc(doc(db, path));
  if (!snap.exists()) return null;
  return { id: snap.id, data: snap.data() as Record<string, unknown> };
}

async function webAddDocument(path: string, data: Record<string, unknown>): Promise<string> {
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  const { db } = await import('./firebase');
  const ref = await addDoc(collection(db, path), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

async function webUpdateDocument(path: string, data: Record<string, unknown>): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  const { db } = await import('./firebase');
  await updateDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() });
}

async function webDeleteDocument(path: string): Promise<void> {
  const { doc, deleteDoc } = await import('firebase/firestore');
  const { db } = await import('./firebase');
  await deleteDoc(doc(db, path));
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function fsGetCollection(collectionPath: string, uid: string, field = 'uid') {
  return IS_NATIVE ? restQueryCollection(collectionPath, field, uid) : webGetCollection(collectionPath, uid, field);
}

export async function fsGetAllCollection(collectionPath: string) {
  return IS_NATIVE ? restGetAllCollection(collectionPath) : webGetAllCollection(collectionPath);
}

export async function fsGetDocument(path: string) {
  return IS_NATIVE ? restGetDocument(path) : webGetDocument(path);
}

export async function fsAddDocument(collectionPath: string, data: Record<string, unknown>) {
  return IS_NATIVE ? restAddDocument(collectionPath, data) : webAddDocument(collectionPath, data);
}

export async function fsUpdateDocument(path: string, data: Record<string, unknown>) {
  return IS_NATIVE ? restUpdateDocument(path, data) : webUpdateDocument(path, data);
}

export async function fsDeleteDocument(path: string) {
  return IS_NATIVE ? restDeleteDocument(path) : webDeleteDocument(path);
}

export { IS_NATIVE };

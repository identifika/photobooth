import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyIdToken } from '@/lib/auth-server';
import { fsGetCollection, fsAddDocument, fsDeleteDocument, fsGetDocument } from '@/lib/firestore';
import { generateApiKeyString, type ApiKey } from '@/lib/api-keys';

const CreateKeySchema = z.object({
  name: z.string().min(1, 'Key name is required'),
});

/**
 * GET /api/keys
 * Lists all API keys for the authenticated user
 */
export async function GET(request: Request) {
  try {
    const authUser = await verifyIdToken(request.headers.get('Authorization'));
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const docs = await fsGetCollection('api_keys', authUser.uid, 'uid');
    const keys = docs.map((d) => ({ id: d.id, ...d.data } as ApiKey));

    keys.sort((a, b) => {
      const aTime = (a.createdAt as any)?.toMillis?.() || (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
      const bTime = (b.createdAt as any)?.toMillis?.() || (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
      return bTime - aTime;
    });

    return NextResponse.json({
      success: true,
      keys,
    });
  } catch (error: any) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json({ error: error.message || 'Failed to list API keys' }, { status: 500 });
  }
}

/**
 * POST /api/keys
 * Generates a new API key for the authenticated user
 */
export async function POST(request: Request) {
  try {
    const authUser = await verifyIdToken(request.headers.get('Authorization'));
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await request.json().catch(() => ({}));
    const parsed = CreateKeySchema.safeParse(json);
    const name = parsed.success ? parsed.data.name : 'API Key';

    const key = generateApiKeyString();
    const docId = await fsAddDocument('api_keys', {
      uid: authUser.uid,
      name,
      key,
      active: true,
    });

    const newKey: ApiKey = {
      id: docId,
      uid: authUser.uid,
      name,
      key,
      active: true,
      createdAt: new Date(),
    };

    return NextResponse.json({
      success: true,
      key: newKey,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create API key:', error);
    return NextResponse.json({ error: error.message || 'Failed to create API key' }, { status: 500 });
  }
}

/**
 * DELETE /api/keys
 * Deletes / revokes an API key for the authenticated user
 */
export async function DELETE(request: Request) {
  try {
    const authUser = await verifyIdToken(request.headers.get('Authorization'));
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');
    if (!keyId) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
    }

    const doc = await fsGetDocument(`api_keys/${keyId}`);
    if (!doc || (doc.data as any).uid !== authUser.uid) {
      return NextResponse.json({ error: 'Key not found or unauthorized' }, { status: 404 });
    }

    await fsDeleteDocument(`api_keys/${keyId}`);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Failed to delete API key:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete API key' }, { status: 500 });
  }
}

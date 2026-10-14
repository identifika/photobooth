import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';

function generateApiKeyString(): string {
  return `pk_live_${randomBytes(20).toString('hex')}`;
}

const CreateKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
});

/** GET /api/keys — the signed-in user's API keys, newest first. */
export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  const keys = await prisma.apiKey.findMany({
    where: { uid: user.uid },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ success: true, keys });
}

/** POST /api/keys — create a key for the signed-in user. */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  const parsed = CreateKeySchema.safeParse(await request.json().catch(() => ({})));
  const name = parsed.success ? parsed.data.name : 'Default API Key';

  const key = await prisma.apiKey.create({
    data: { uid: user.uid, name, key: generateApiKeyString() },
  });
  return NextResponse.json({ success: true, key }, { status: 201 });
}

/** DELETE /api/keys?id=... — revoke one of the signed-in user's keys. */
export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);

  const keyId = new URL(request.url).searchParams.get('id');
  if (!keyId) return jsonError('Key ID is required', 400);

  const { count } = await prisma.apiKey.deleteMany({ where: { id: keyId, uid: user.uid } });
  if (count === 0) return jsonError('Key not found', 404);
  return NextResponse.json({ success: true });
}

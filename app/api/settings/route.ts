import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';

const DEFAULTS = { studioName: 'Pika', studioLogo: '📷', tagline: 'Capture the moment' };

function toJson(row: { studioName: string; studioLogo: string; tagline: string } | null) {
  if (!row) return DEFAULTS;
  return { studioName: row.studioName, studioLogo: row.studioLogo, tagline: row.tagline };
}

/** GET /api/settings — public studio branding. */
export async function GET() {
  try {
    const row = await prisma.studioSettings.findUnique({ where: { id: 'studio' } });
    return NextResponse.json(toJson(row));
  } catch (error) {
    console.error('Failed to load studio settings:', error);
    return NextResponse.json(DEFAULTS);
  }
}

/** PUT /api/settings — admin only. */
export async function PUT(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);
  if (!user.isAdmin) return jsonError('Forbidden', 403);

  const body = await request.json().catch(() => ({}));
  const data: Partial<typeof DEFAULTS> = {};
  for (const field of ['studioName', 'studioLogo', 'tagline'] as const) {
    if (typeof body[field] === 'string') data[field] = body[field];
  }

  const row = await prisma.studioSettings.upsert({
    where: { id: 'studio' },
    create: { id: 'studio', ...DEFAULTS, ...data },
    update: data,
  });
  return NextResponse.json(toJson(row));
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser, jsonError } from '@/lib/auth-server';

const DEFAULTS = {
  studioName: 'Pika',
  studioLogo: '📷',
  tagline: 'Capture the moment',
  aiProvider: 'gemini',
  aiModel: 'gemini-2.5-flash',
  aiApiKey: '',
  aiBaseUrl: '',
  aiDailyLimit: 3,
};

type StudioRow = {
  studioName: string;
  studioLogo: string;
  tagline: string;
  aiProvider?: string;
  aiModel?: string;
  aiApiKey?: string | null;
  aiBaseUrl?: string | null;
  aiDailyLimit?: number;
} | null;

function toJson(row: StudioRow, isAdmin: boolean) {
  const base = {
    studioName: row?.studioName || DEFAULTS.studioName,
    studioLogo: row?.studioLogo || DEFAULTS.studioLogo,
    tagline: row?.tagline || DEFAULTS.tagline,
  };
  if (!isAdmin) return base;

  return {
    ...base,
    aiProvider: row?.aiProvider || DEFAULTS.aiProvider,
    aiModel: row?.aiModel || DEFAULTS.aiModel,
    aiApiKey: row?.aiApiKey || '',
    aiBaseUrl: row?.aiBaseUrl || '',
    aiDailyLimit: row?.aiDailyLimit ?? DEFAULTS.aiDailyLimit,
  };
}

/** GET /api/settings — public studio branding, plus AI config if admin. */
export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    const row = await prisma.studioSettings.findUnique({ where: { id: 'studio' } });
    return NextResponse.json(toJson(row, !!user?.isAdmin));
  } catch (error) {
    console.error('Failed to load studio settings:', error);
    return NextResponse.json({
      studioName: DEFAULTS.studioName,
      studioLogo: DEFAULTS.studioLogo,
      tagline: DEFAULTS.tagline,
    });
  }
}

/** PUT /api/settings — admin only. */
export async function PUT(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return jsonError('Unauthorized', 401);
  if (!user.isAdmin) return jsonError('Forbidden', 403);

  const body = await request.json().catch(() => ({}));
  const data: Record<string, any> = {};

  for (const field of ['studioName', 'studioLogo', 'tagline', 'aiProvider', 'aiModel', 'aiApiKey', 'aiBaseUrl'] as const) {
    if (typeof body[field] === 'string') data[field] = body[field].trim();
  }
  if (typeof body.aiDailyLimit === 'number' && Number.isFinite(body.aiDailyLimit)) {
    data.aiDailyLimit = Math.max(0, Math.floor(body.aiDailyLimit));
  }

  const row = await prisma.studioSettings.upsert({
    where: { id: 'studio' },
    create: { id: 'studio', ...DEFAULTS, ...data },
    update: data,
  });
  return NextResponse.json(toJson(row, true));
}

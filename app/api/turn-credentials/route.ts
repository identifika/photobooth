import { NextResponse, NextRequest } from 'next/server';

const turnixToken = process.env.TURNIX_TOKEN;

// Turnix credential TTL — must match the ttl param sent below
const CREDENTIAL_TTL_SECONDS = 120;

export async function POST(req: NextRequest) {
  if (!turnixToken) {
    console.error('TURNIX_TOKEN not set in environment');
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const { room, initiatorClient, receiverClient } = body ?? {};

  // Real client IP for GeoIP region routing
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    undefined;

  const params = new URLSearchParams({ ttl: String(CREDENTIAL_TTL_SECONDS) });
  if (room) params.set('room', room);
  if (initiatorClient) params.set('initiator_client', initiatorClient);
  if (receiverClient) params.set('receiver_client', receiverClient);

  try {
    const res = await fetch('https://turnix.io/api/v1/credentials/ice', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${turnixToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(clientIp ? { 'X-TURN-CLIENT-IP': clientIp } : {}),
      },
      body: params,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Turnix credential error:', res.status, errText);
      return NextResponse.json(
        { error: 'failed to fetch ICE credentials' },
        { status: 502 }
      );
    }

    const data = await res.json();

    return NextResponse.json(
      { iceServers: data.iceServers ?? [], ttlSeconds: CREDENTIAL_TTL_SECONDS },
      {
        headers: {
          'Cache-Control': `private, max-age=${CREDENTIAL_TTL_SECONDS - 10}`,
        },
      }
    );
  } catch (err) {
    console.error('Turnix fetch failed:', err);
    return NextResponse.json(
      { error: 'ICE credential request failed' },
      { status: 502 }
    );
  }
}
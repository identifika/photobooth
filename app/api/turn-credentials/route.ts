import { NextResponse } from 'next/server';

// Server-side only — token never exposed to browser
const turnixToken = process.env.TURNIX_TOKEN;

export async function POST() {
  if (!turnixToken) {
    console.error('TURNIX_TOKEN not set in environment');
    return NextResponse.json({ iceServers: [] });
  }

  try {
    // Call Turnix API to get fresh TURN credentials
    const res = await fetch('https://turnix.io/api/v1/credentials/ice', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${turnixToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.error('Turnix credential error:', res.status);
      return NextResponse.json({ iceServers: [] });
    }

    const data = await res.json();
    return NextResponse.json({ iceServers: data.iceServers || [] });
  } catch (err) {
    console.error('Turnix fetch failed:', err);
    return NextResponse.json({ iceServers: [] });
  }
}

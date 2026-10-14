import { NextResponse } from 'next/server';
import {
  extractSessionToken,
  deleteSession,
  clearSessionCookie,
} from '@/lib/auth-server';

export async function POST(request: Request) {
  try {
    const token = extractSessionToken(request);
    if (token) {
      await deleteSession(token);
    }

    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  }
}

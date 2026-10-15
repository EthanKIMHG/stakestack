import { NextResponse } from 'next/server';
import { getSession, privy } from '@/lib/privy';

export const dynamic = 'force-dynamic';

/** Who the server thinks is signed in. Also a quick check that PRIVY_APP_SECRET is set correctly. */
export async function GET(req: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!privy()) return NextResponse.json({ error: 'sign-in is not configured' }, { status: 503, headers });
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'not signed in' }, { status: 401, headers });
  return NextResponse.json(session, { headers });
}

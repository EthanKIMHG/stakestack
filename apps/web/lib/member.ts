import 'server-only';
import { NextResponse } from 'next/server';
import { getSession } from './privy';
import { supabaseAdmin } from './supabase-admin';

export const NO_STORE = { 'Cache-Control': 'no-store' };

/** Guard for member routes: a verified Privy session and a server-side DB client, or the error response. */
export async function memberGuard(req: Request): Promise<{ userId: string } | { error: NextResponse }> {
  const session = await getSession(req);
  if (!session) return { error: NextResponse.json({ error: 'sign in first' }, { status: 401, headers: NO_STORE }) };
  if (!supabaseAdmin()) return { error: NextResponse.json({ error: 'member stacks are not configured' }, { status: 503, headers: NO_STORE }) };
  return { userId: session.userId };
}

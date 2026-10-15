import 'server-only';
import { PrivyClient } from '@privy-io/node';

/** Env values pasted into dashboards often carry quotes, spaces or a trailing newline. */
function clean(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/^["']|["']$/g, '').trim();
}

let client: PrivyClient | null | undefined;

/**
 * Server half of Privy sign-in (docs/AUTH.md). Null until both NEXT_PUBLIC_PRIVY_APP_ID and
 * PRIVY_APP_SECRET are set, so the app keeps working without auth.
 */
export function privy(): PrivyClient | null {
  if (client !== undefined) return client;
  const appId = clean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
  const appSecret = clean(process.env.PRIVY_APP_SECRET);
  // With the verification key from the dashboard, tokens are checked locally instead of fetching the key once per instance.
  const jwtVerificationKey = clean(process.env.PRIVY_JWT_VERIFICATION_KEY).replace(/\\n/g, '\n') || undefined;
  client = appId && appSecret ? new PrivyClient({ appId, appSecret, jwtVerificationKey }) : null;
  return client;
}

export interface Session { userId: string; sessionId: string; expiresAt: number }

function cookie(header: string | null, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/**
 * The signed-in user behind a request, or null. The browser sends its Privy access token as
 * `Authorization: Bearer …` (default token storage); the `privy-token` cookie is read too in case
 * HTTP-only cookies are turned on later.
 */
export async function getSession(req: Request): Promise<Session | null> {
  const c = privy();
  if (!c) return null;
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : cookie(req.headers.get('cookie'), 'privy-token');
  if (!token) return null;
  try {
    const claims = await c.utils().auth().verifyAccessToken(token);
    return { userId: claims.user_id, sessionId: claims.session_id, expiresAt: claims.expiration };
  } catch {
    return null;
  }
}

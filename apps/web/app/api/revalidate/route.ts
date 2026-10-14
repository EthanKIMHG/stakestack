import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createHash, timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';

/** Env values pasted into dashboards often carry quotes, spaces or a trailing newline. */
function clean(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/^["']|["']$/g, '').trim();
}

/** sha256 prefix: lets an operator compare the deployed secret with their local one without revealing it. */
function fingerprint(v: string): string {
  return createHash('sha256').update(v).digest('hex').slice(0, 8);
}

/**
 * Identity probe. The ingester checks `app` before sending its secret, so a
 * wrong NEXT_PUBLIC_SITE_URL cannot leak it. `secret` helps debug a mismatch.
 */
export function GET() {
  const s = clean(process.env.REVALIDATE_SECRET);
  return NextResponse.json({ app: 'stakestack', secret: s ? { configured: true, length: s.length, sha256_prefix: fingerprint(s) } : { configured: false } });
}

/** Called by the ingester after new rows land. Busts ISR for affected pages. */
export async function POST(req: Request) {
  const secret = clean(process.env.REVALIDATE_SECRET);
  const given = clean(req.headers.get('x-revalidate-secret'));
  const ok = secret.length > 0 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { components?: string[] };
  revalidatePath('/');
  revalidatePath('/upgrades');
  revalidatePath('/releases');
  for (const c of body.components ?? []) revalidatePath(`/c/${c}`);
  revalidatePath('/s/[slug]', 'page');
  revalidatePath('/api/feed/[slug]', 'page');
  return NextResponse.json({ ok: true, components: body.components ?? [] });
}

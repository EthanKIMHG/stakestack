import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/** Identity probe: the ingester checks this before sending its secret, so a wrong NEXT_PUBLIC_SITE_URL cannot leak it. */
export function GET() {
  return NextResponse.json({ app: 'stakestack' });
}

/** Called by the ingester after new rows land. Busts ISR for affected pages. */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get('x-revalidate-secret') !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { components?: string[] };
  revalidatePath('/');
  revalidatePath('/upgrades');
  for (const c of body.components ?? []) revalidatePath(`/c/${c}`);
  revalidatePath('/s/[slug]', 'page');
  revalidatePath('/api/feed/[slug]', 'page');
  return NextResponse.json({ ok: true, components: body.components ?? [] });
}

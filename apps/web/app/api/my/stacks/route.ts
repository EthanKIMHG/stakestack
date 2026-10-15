import { NextResponse } from 'next/server';
import { memberGuard, NO_STORE } from '@/lib/member';
import { createMemberStack, listMemberStacks, normalizeStack, type StackInput } from '@/lib/stacks';

export const dynamic = 'force-dynamic';

/** The signed-in member's stacks, newest first. */
export async function GET(req: Request) {
  const g = await memberGuard(req);
  if ('error' in g) return g.error;
  try {
    return NextResponse.json({ stacks: await listMemberStacks(g.userId) }, { headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE });
  }
}

/** Save a new stack to the member's account. */
export async function POST(req: Request) {
  const g = await memberGuard(req);
  if ('error' in g) return g.error;
  const parsed = await normalizeStack(await req.json().catch(() => null) as StackInput | null);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: NO_STORE });
  try {
    const r = await createMemberStack(g.userId, parsed.value);
    return r.ok ? NextResponse.json({ stack: r.value }, { status: 201, headers: NO_STORE }) : NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE });
  }
}

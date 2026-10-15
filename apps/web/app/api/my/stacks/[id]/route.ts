import { NextResponse } from 'next/server';
import { memberGuard, NO_STORE } from '@/lib/member';
import { deleteMemberStack, normalizeStack, updateMemberStack, type StackInput } from '@/lib/stacks';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Update one of the member's stacks (name, picks, cluster). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'stack not found' }, { status: 404, headers: NO_STORE });
  const g = await memberGuard(req);
  if ('error' in g) return g.error;
  const parsed = await normalizeStack(await req.json().catch(() => null) as StackInput | null);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers: NO_STORE });
  try {
    const r = await updateMemberStack(g.userId, id, parsed.value);
    return r.ok ? NextResponse.json({ stack: r.value }, { headers: NO_STORE }) : NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'stack not found' }, { status: 404, headers: NO_STORE });
  const g = await memberGuard(req);
  if ('error' in g) return g.error;
  try {
    const r = await deleteMemberStack(g.userId, id);
    return r.ok ? NextResponse.json({ ok: true }, { headers: NO_STORE }) : NextResponse.json({ error: r.error }, { status: r.status, headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: NO_STORE });
  }
}

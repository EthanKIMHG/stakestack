import { NextResponse } from 'next/server';
import { compose } from '@stakestack/shared/composer';
import type { StackSelection, Topology } from '@stakestack/shared/types';
import { getCatalog } from '@/lib/catalog';
import { supabase } from '@/lib/supabase';

/** Anonymous stack creation for share links. Validated server-side with the same compose() the UI uses. */
export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_ENABLE_ANON_STACKS === 'false') return NextResponse.json({ error: 'disabled' }, { status: 403 });
  const sb = supabase();
  if (!sb) return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  const body = await req.json().catch(() => null) as { name?: string; selection?: StackSelection; topology?: Topology | null; running_versions?: Record<string, string> } | null;
  if (!body?.selection || typeof body.selection !== 'object') return NextResponse.json({ error: 'selection required' }, { status: 400 });
  const catalog = await getCatalog();
  const result = compose(catalog, body.selection, body.topology ?? null);
  const errors = result.diagnostics.filter(d => d.level === 'error');
  if (errors.length) return NextResponse.json({ error: errors.map(e => e.message).join(' ') }, { status: 422 });

  // Store only what is visible after rules; cluster roles are the union of node clients.
  const selection: StackSelection = { network: result.networks };
  for (const s of result.slots) if (s.slot.id !== 'network' && s.visible && s.selected.length) selection[s.slot.id] = s.selected;
  const topology = result.cluster && body.topology?.nodes?.length
    ? { nodes: body.topology.nodes.slice(0, 16).map(n => ({ label: (n.label ?? '').slice(0, 40) || undefined, execution: n.execution, consensus: n.consensus, validator: result.cluster!.roles.includes('validator') ? n.validator : undefined })), threshold: body.topology.threshold }
    : null;

  const name = (body.name ?? 'Untitled stack').slice(0, 80);
  const { data, error } = await sb.from('stacks').insert({ name, selection, topology, running_versions: body.running_versions ?? {} }).select('slug').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slug: data.slug });
}

import { NextResponse } from 'next/server';
import { compose } from '@stakestack/shared/composer';
import { computeReadiness } from '@stakestack/shared/readiness';
import type { StackSelection, Topology } from '@stakestack/shared/types';
import { getCatalog, getReleases } from '@/lib/catalog';

/** Live fork readiness for an unsaved selection (used by the builder side panel). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { selection?: StackSelection; topology?: Topology | null } | null;
  if (!body?.selection || typeof body.selection !== 'object') return NextResponse.json({ error: 'selection required' }, { status: 400 });
  const catalog = await getCatalog();
  const result = compose(catalog, body.selection, body.topology ?? null);
  const releases = await getReleases(result.effectiveComponents);
  const nets = computeReadiness(catalog, { name: 'draft', selection: { ...result.selection, ...pickVisible(result) } }, releases);
  return NextResponse.json({
    networks: nets.map(n => ({
      id: n.network.id, name: n.network.name, phase: n.phase, wave: n.upgrade?.wave ?? null,
      activation_time: n.activation_time, tentative: !!n.upgrade?.tentative, summary: n.summary,
      components: n.components.map(c => ({ slug: c.component_slug, required: c.required, latest: c.latest_release, state: c.state })),
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Only count slots that are visible after rules (e.g. SSV hides the VC slot). */
function pickVisible(r: ReturnType<typeof compose>): StackSelection {
  const out: StackSelection = { network: r.networks };
  for (const s of r.slots) if (s.slot.id !== 'network') out[s.slot.id] = s.visible ? s.selected : [];
  return out;
}

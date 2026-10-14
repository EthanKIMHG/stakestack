import { NextResponse } from 'next/server';
import { siteUrl } from '@/lib/site';
import { getStack, getTimeline } from '@/lib/catalog';

export const revalidate = 300;

function esc(s: string) { return s.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!)); }

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const [slug, ext = 'rss'] = raw.split('.') as [string, string?];
  const stack = await getStack(slug);
  if (!stack) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const rows = await getTimeline(stack.selection, 50);
  const site = siteUrl();
  if (ext === 'json') return NextResponse.json({ stack: { name: stack.name, slug, selection: stack.selection }, items: rows });
  const items = rows.map(r => `<item>
  <title>[${r.severity.toUpperCase()}] ${esc(r.component_name)} ${esc(r.tag)}${r.is_prerelease ? ' (pre-release)' : ''}</title>
  <link>${esc(r.url)}</link>
  <guid isPermaLink="false">${esc(`${r.component_slug}@${r.tag}`)}</guid>
  <pubDate>${new Date(r.published_at).toUTCString()}</pubDate>
  <category>${r.severity}</category>${r.flags.map(f => `<category>${f}</category>`).join('')}
  <description>${esc(`score ${r.score}; flags: ${r.flags.join(', ') || 'none'}; networks: ${r.networks.join(', ') || 'n/a'}\n` + (r.evidence ?? []).map(e => `- ${e.text}`).join('\n'))}</description>
</item>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>stakestack · ${esc(stack.name)}</title>
<link>${esc(`${site}/s/${slug}`)}</link>
<description>Releases for this staking stack, ranked by assessed severity.</description>
${items}
</channel></rss>`;
  return new NextResponse(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}

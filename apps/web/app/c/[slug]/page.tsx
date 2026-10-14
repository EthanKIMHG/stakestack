import { notFound } from 'next/navigation';
import { getCatalog, getTimeline } from '@/lib/catalog';
import { ReleaseList } from '@/components/ReleaseList';
import { Card, NetDot } from '@/components/ui';
import { JsonLd } from '@/components/JsonLd';
import { siteUrl } from '@/lib/site';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getCatalog();
  const c = catalog.components.find(x => x.slug === slug);
  if (!c) return { title: 'Component not found', robots: { index: false } };
  const rows = await getTimeline({ network: ['mainnet'], any: [slug] }, 5);
  const latest = rows[0];
  const req = catalog.upgrades.filter(u => u.required_versions?.[slug]).sort((a, b) => (b.activation_time ?? '').localeCompare(a.activation_time ?? ''))[0];
  const parts = [
    c.summary,
    latest ? `Latest stable release ${latest.tag} (${latest.severity}).` : null,
    req ? `${req.wave[0]!.toUpperCase()}${req.wave.slice(1)} on ${req.network} requires ${c.name} >= ${req.required_versions[slug]}.` : null,
  ].filter(Boolean);
  const title = `${c.name} releases and hard fork readiness`;
  const description = parts.join(' ').slice(0, 300);
  return {
    title,
    description,
    alternates: { canonical: `/c/${slug}` },
    openGraph: { title, description, url: `/c/${slug}`, type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}

export const revalidate = 300;

export default async function ComponentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const c = catalog.components.find(x => x.slug === slug);
  if (!c) notFound();
  const rows = await getTimeline({ network: ['hoodi'], any: [slug] }, 80);
  const required = catalog.upgrades.filter(u => u.required_versions?.[slug]).sort((a, b) => (b.activation_time ?? '').localeCompare(a.activation_time ?? ''));
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareSourceCode',
        name: c.name,
        description: c.summary,
        codeRepository: `https://github.com/${c.repo}`,
        programmingLanguage: c.language,
        license: c.license,
        author: c.vendor ? { '@type': 'Organization', name: c.vendor } : undefined,
        url: `${siteUrl()}/c/${c.slug}`,
        ...(rows.find(r => !r.is_prerelease) ? { version: rows.find(r => !r.is_prerelease)!.tag } : {}),
      }} />
      <section className="card card-pad">
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <h1 className="page-title">{c.name}</h1>
          <span className="muted">{c.vendor}</span>
          {c.status !== 'active' && <span className="chip chip-warn">{c.status}</span>}
        </div>
        {c.summary && <p style={{ marginTop: 6 }}>{c.summary}</p>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {c.roles.map(r => <span key={r} className="chip chip-accent">{r}</span>)}
          {c.language && <span className="chip">{c.language}</span>}
          {c.license && <span className="chip">{c.license}</span>}
          {(c.networks ?? []).map(n => <span key={n} className="chip"><NetDot id={n} />{n}</span>)}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14, fontSize: 14 }}>
          <a href={`https://github.com/${c.repo}`} target="_blank" rel="noreferrer">github.com/{c.repo} ↗</a>
          {c.docs && <a href={c.docs} target="_blank" rel="noreferrer">Docs ↗</a>}
          {c.homepage && <a href={c.homepage} target="_blank" rel="noreferrer">Website ↗</a>}
          {c.docker_image && <span className="mono muted">{c.docker_image}</span>}
        </div>
        {c.notes && <p className="muted" style={{ marginTop: 12, fontSize: 13.5 }}>{c.notes}</p>}
      </section>
      {required.length > 0 && (
        <Card title="Required by network upgrades">
          <table className="matrix">
            <thead><tr><th>Upgrade</th><th>Network</th><th>Minimum</th></tr></thead>
            <tbody>{required.map(u => <tr key={u.id}><td>{u.wave}</td><td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><NetDot id={u.network} />{u.network}</span></td><td className="v">≥ {u.required_versions[slug]}</td></tr>)}</tbody>
          </table>
        </Card>
      )}
      <Card title={<div><h2>Releases</h2><span className="faint" style={{ fontSize: 13 }}>Assessed by the <span className="mono">{c.assessor}</span> rules · weight {c.priority_weight ?? 1}</span></div>}>
        <ReleaseList rows={rows} linkComponents={false} />
      </Card>
    </div>
  );
}

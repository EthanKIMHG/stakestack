import './env';
import pg from 'pg';

/** Quick health report of what is in the database. `pnpm --filter @stakestack/ingest stats` */
async function main() {
  const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async <T = Record<string, unknown>>(sql: string) => (await c.query<T>(sql)).rows;
  try {
    console.log('releases:', (await q('select count(*)::int n, count(distinct component_slug)::int comps, sum((is_prerelease)::int)::int pre from releases'))[0]);
    console.log('assessments by severity:', await q('select severity, count(*)::int n from release_assessment_effective group by 1 order by 2 desc'));
    console.log('advisories:', (await q('select count(*)::int n, count(distinct component_slug)::int comps from advisories'))[0]);
    console.log('components without releases:', (await q<{ s: string }>("select coalesce(string_agg(slug, ', '), '-') s from components c where not exists (select 1 from releases r where r.component_slug=c.slug)"))[0]?.s);
    console.log('recent critical/high, stable, weight>=1:');
    console.table(await q(`select a.component_slug, a.release_tag, a.severity, array_to_string(a.flags, ',') flags, r.published_at::date d from release_assessment_effective a join releases r on r.component_slug=a.component_slug and r.tag=a.release_tag join components c on c.slug=a.component_slug where a.severity in ('critical','high') and not r.is_prerelease and c.priority_weight>=1 order by r.published_at desc limit 12`));
    console.log('stack_timeline sample (nethermind+lighthouse+charon+web3signer+mev-boost on hoodi+mainnet):');
    console.table(await q(`select component_slug, tag, severity, is_prerelease pre, published_at::date d from stack_timeline('{"network":["hoodi","mainnet"],"execution":["nethermind"],"consensus":["lighthouse"],"validator":["lighthouse"],"dvt":["charon"],"remote-signer":["web3signer"],"mev":["mev-boost"]}'::jsonb, 10)`));
    console.log('ingest runs:', await q('select started_at::timestamp(0) t, new_releases, advisories, graphql_points gql, rest_requests rest, rest_304 from ingest_runs order by id desc limit 5'));
  } finally { await c.end(); }
}
main().catch(e => { console.error(e.message ?? e); process.exit(1); });

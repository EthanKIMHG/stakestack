-- stakestack initial schema
-- Apply with: pnpm db:migrate  (psql $SUPABASE_DB_URL -f ...) or `supabase db push`.
create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ catalog --
create table if not exists networks (
  id            text primary key,
  name          text not null,
  kind          text not null check (kind in ('mainnet','testnet','ephemeral')),
  chain_id      bigint,
  config_repo   text,
  rollout_order int  not null default 0,
  deprecated    boolean not null default false,
  description   text
);

create table if not exists fork_waves (
  id        text primary key,
  name      text not null,
  status    text not null check (status in ('planning','in_progress','completed')),
  meta_eip  text
);

create table if not exists components (
  slug               text primary key,
  name               text not null,
  vendor             text,
  summary            text,
  roles              text[] not null,
  repo               text not null,
  release_source     text not null default 'releases' check (release_source in ('releases','tags')),
  stable_tag_pattern text,
  homepage           text,
  docs               text,
  docker_image       text,
  language           text,
  license            text,
  networks           text[],
  status             text not null,
  assessor           text not null,
  embeds             text[],
  supports           jsonb not null default '{}'::jsonb,
  tags               text[] not null default '{}',
  priority_weight    numeric not null default 1,
  notes              text,
  repo_archived      boolean,
  repo_pushed_at     timestamptz,
  updated_at         timestamptz not null default now()
);
create index if not exists components_roles_idx on components using gin (roles);

create table if not exists slots (
  id                text primary key,
  label             text not null,
  description       text,
  role              text not null,
  cardinality       text not null check (cardinality in ('one','many')),
  required          boolean not null default false,
  hidden_by_default boolean not null default false,
  sort_order        int not null default 0
);

create table if not exists composition_rules (
  id           text primary key,
  description  text,
  when_clause  jsonb not null,
  then_clause  jsonb not null
);

create table if not exists catalog_meta (
  id    text primary key,
  value jsonb not null
);

-- ------------------------------------------------------- network upgrades --
create table if not exists network_upgrades (
  id                text primary key,
  wave_id           text not null references fork_waves(id),
  network_id        text not null references networks(id),
  status            text not null check (status in ('draft','planned','scheduled','activated','cancelled')),
  activation_epoch  bigint,
  activation_time   timestamptz,
  announcement_url  text,
  verified          boolean not null default false,
  required_versions jsonb not null default '{}'::jsonb,   -- component slug -> min version
  notes             text,
  source            text not null default 'catalog',      -- catalog | feed-draft | manual
  updated_at        timestamptz not null default now()
);
create index if not exists network_upgrades_net_idx on network_upgrades (network_id, activation_time);

-- ---------------------------------------------------------------- releases --
create table if not exists releases (
  id                 bigserial primary key,
  component_slug     text not null references components(slug) on delete cascade,
  repo               text not null,
  tag                text not null,
  name               text,
  url                text not null,
  body               text,
  is_prerelease      boolean not null default false,
  is_draft           boolean not null default false,
  published_at       timestamptz not null,
  github_node_id     text,
  github_database_id bigint,
  source             text not null default 'releases',
  ingested_at        timestamptz not null default now(),
  unique (component_slug, tag)
);
create index if not exists releases_published_idx on releases (published_at desc);
create index if not exists releases_component_idx on releases (component_slug, published_at desc);

create table if not exists release_assessments (
  id               bigserial primary key,
  component_slug   text not null,
  release_tag      text not null,
  severity         text not null check (severity in ('critical','high','recommended','optional','unassessed')),
  score            int  not null default 0,
  flags            text[] not null default '{}',
  networks         text[] not null default '{}',
  wave_id          text references fork_waves(id),
  evidence         jsonb not null default '[]'::jsonb,
  summary          text,
  assessor         text not null,
  assessor_version text not null,
  source           text not null default 'rules' check (source in ('rules','llm','manual')),
  created_at       timestamptz not null default now(),
  unique (component_slug, release_tag, source),
  foreign key (component_slug, release_tag) references releases(component_slug, tag) on delete cascade
);
create index if not exists release_assessments_sev_idx on release_assessments (severity, created_at desc);

-- Effective assessment: manual > llm > rules
create or replace view release_assessment_effective as
select distinct on (component_slug, release_tag)
  component_slug, release_tag, severity, score, flags, networks, wave_id, evidence, summary, assessor, assessor_version, source
from release_assessments
order by component_slug, release_tag,
  case source when 'manual' then 0 when 'llm' then 1 else 2 end;

create table if not exists advisories (
  ghsa_id        text not null,
  component_slug text not null references components(slug) on delete cascade,
  cve_id         text,
  summary        text not null,
  severity       text,
  url            text not null,
  published_at   timestamptz,
  updated_at     timestamptz,
  withdrawn_at   timestamptz,
  primary key (ghsa_id, component_slug)
);

-- ------------------------------------------------------------------ stacks --
create table if not exists stacks (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique,                -- short public id for share links
  name             text not null,
  selection        jsonb not null,             -- slot id -> component slugs; selection.network -> network ids
  running_versions jsonb not null default '{}'::jsonb,
  owner_id         uuid references auth.users(id) on delete set null,
  is_public        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists stacks_owner_idx on stacks (owner_id);

-- ----------------------------------------------------------------- ingest --
create table if not exists ingest_runs (
  id               bigserial primary key,
  started_at       timestamptz not null,
  finished_at      timestamptz not null,
  repos            int, batches int, new_releases int, advisories int,
  graphql_points   int, rest_requests int, rest_304 int,
  remaining_points int, remaining_rest int,
  dry_run          boolean not null default false
);

-- ---------------------------------------------------------- feed function --
-- Timeline for a stack: releases of its components, ranked by weighted severity.
-- Pre-releases are included only when the stack runs a non-mainnet network.
create or replace function stack_timeline(p_selection jsonb, p_limit int default 100)
returns table (
  component_slug text, component_name text, tag text, name text, url text, is_prerelease boolean, published_at timestamptz,
  severity text, score int, flags text[], networks text[], wave_id text, evidence jsonb, weighted_score numeric
) language sql stable as $$
  with sel as (
    select distinct jsonb_array_elements_text(value) as slug
    from jsonb_each(p_selection) where key <> 'network'
  ), nets as (
    select jsonb_array_elements_text(coalesce(p_selection->'network','[]'::jsonb)) as net
  ), allow_pre as (
    select exists (select 1 from nets where net <> 'mainnet') as v
  )
  select r.component_slug, c.name, r.tag, r.name, r.url, r.is_prerelease, r.published_at,
         coalesce(a.severity,'unassessed'), coalesce(a.score,0), coalesce(a.flags,'{}'), coalesce(a.networks,'{}'), a.wave_id, coalesce(a.evidence,'[]'::jsonb),
         coalesce(a.score,0) * c.priority_weight as weighted_score
  from releases r
  join components c on c.slug = r.component_slug
  join sel on sel.slug = r.component_slug
  left join release_assessment_effective a on a.component_slug = r.component_slug and a.release_tag = r.tag
  cross join allow_pre
  where r.is_draft = false and (allow_pre.v or r.is_prerelease = false)
  order by r.published_at desc
  limit p_limit;
$$;

-- Next upgrade per network with required versions (for readiness UI)
create or replace view next_network_upgrade as
select distinct on (network_id) *
from network_upgrades
where status not in ('cancelled','draft')
order by network_id,
  case when status = 'activated' and activation_time < now() then 1 else 0 end,
  coalesce(activation_time, 'infinity'::timestamptz);

-- -------------------------------------------------------------------- RLS --
alter table networks enable row level security;
alter table fork_waves enable row level security;
alter table components enable row level security;
alter table slots enable row level security;
alter table composition_rules enable row level security;
alter table catalog_meta enable row level security;
alter table network_upgrades enable row level security;
alter table releases enable row level security;
alter table release_assessments enable row level security;
alter table advisories enable row level security;
alter table stacks enable row level security;
alter table ingest_runs enable row level security;

-- Public read for all reference data
do $$ declare t text; begin
  foreach t in array array['networks','fork_waves','components','slots','composition_rules','catalog_meta','network_upgrades','releases','release_assessments','advisories','ingest_runs'] loop
    execute format('drop policy if exists %I on %I', t || '_public_read', t);
    execute format('create policy %I on %I for select using (true)', t || '_public_read', t);
  end loop;
end $$;

-- Stacks: public ones readable by anyone; anonymous insert allowed (share links); owners manage their own.
drop policy if exists stacks_read on stacks;
create policy stacks_read on stacks for select using (is_public or owner_id = auth.uid());
drop policy if exists stacks_insert on stacks;
create policy stacks_insert on stacks for insert with check (owner_id is null or owner_id = auth.uid());
drop policy if exists stacks_update_owner on stacks;
create policy stacks_update_owner on stacks for update using (owner_id = auth.uid());
drop policy if exists stacks_delete_owner on stacks;
create policy stacks_delete_owner on stacks for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------- grants --
-- Since 2026-10-30 Supabase no longer grants the Data API roles access to new tables in `public`
-- automatically, so every table, sequence and view states its grants in the migration that creates
-- it. Without these a fresh project, a preview branch or `supabase db reset` answers every
-- supabase-js call with "permission denied". RLS above still decides which rows a role sees.
grant usage on schema public to anon, authenticated, service_role;

-- Reference data: read-only for the API roles; written by the ingester with the secret key.
grant select on networks, fork_waves, components, slots, composition_rules, catalog_meta,
  network_upgrades, releases, release_assessments, advisories, ingest_runs
  to anon, authenticated;
grant select, insert, update, delete on networks, fork_waves, components, slots, composition_rules,
  catalog_meta, network_upgrades, releases, release_assessments, advisories, ingest_runs
  to service_role;

-- Stacks: the publishable key creates share links and owners edit their own (policies above).
grant select, insert, update, delete on stacks to anon, authenticated, service_role;

-- bigserial sequences: only the secret key inserts into these tables.
grant usage, select on releases_id_seq, release_assessments_id_seq, ingest_runs_id_seq to service_role;

-- Views and the feed function (functions are executable by everyone by default; stated for clarity).
grant select on release_assessment_effective, next_network_upgrade to anon, authenticated, service_role;
grant execute on function stack_timeline(jsonb, int) to anon, authenticated, service_role;

-- short slug for share links
create or replace function set_stack_slug() returns trigger language plpgsql as $$
begin
  if new.slug is null then new.slug := encode(gen_random_bytes(6), 'hex'); end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists stacks_slug on stacks;
create trigger stacks_slug before insert or update on stacks for each row execute function set_stack_slug();

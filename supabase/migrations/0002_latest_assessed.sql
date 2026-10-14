-- Flat view for the home page: latest releases with their effective assessment.
-- PostgREST cannot embed through release_assessment_effective (a view without FK
-- metadata), so the join is done here instead of in the client.
create or replace view latest_assessed as
select r.component_slug, c.name as component_name, r.tag, r.name, r.url, r.is_prerelease, r.published_at,
       coalesce(a.severity, 'unassessed') as severity, coalesce(a.score, 0) as score, coalesce(a.flags, '{}') as flags,
       coalesce(a.networks, '{}') as networks, a.wave_id, coalesce(a.evidence, '[]'::jsonb) as evidence,
       coalesce(a.score, 0) * c.priority_weight as weighted_score, c.priority_weight
from releases r
join components c on c.slug = r.component_slug
left join release_assessment_effective a on a.component_slug = r.component_slug and a.release_tag = r.tag
where r.is_draft = false;

grant select on latest_assessed to anon, authenticated;

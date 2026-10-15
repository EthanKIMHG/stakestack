-- Composition rules cite the documentation they are based on.
--
-- `sources` lists official docs (Obol, SSV, Lido, Rocket Pool, client docs) and `verified_at` is the
-- date someone last checked the rule against them. The builder links each note to its source so an
-- operator can tell a documented requirement from stakestack's own advice.
alter table composition_rules add column if not exists sources     text[] not null default '{}';
alter table composition_rules add column if not exists verified_at date;

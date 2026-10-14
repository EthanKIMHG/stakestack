-- DVT clusters, tag-filtered slots and tentative upgrade dates.
alter table slots add column if not exists include_tag text;
alter table slots add column if not exists exclude_tag text;
alter table network_upgrades add column if not exists tentative boolean not null default false;
-- Per-node client assignment for DVT stacks: { "nodes": [{ "label", "execution", "consensus", "validator" }], "threshold"? }
alter table stacks add column if not exists topology jsonb;

-- Rules removed from catalog/slots.yaml must disappear from the table too; sync re-inserts the current ones.
delete from composition_rules where id in ('hoodi-testnet', 'sepolia-testnet', 'mainnet-only');

-- next_network_upgrade view uses select *, so it must be recreated to pick up the new column.
drop view if exists next_network_upgrade;
create view next_network_upgrade as
select distinct on (network_id) *
from network_upgrades
where status not in ('cancelled','draft')
order by network_id,
  case when status = 'activated' and activation_time < now() then 1 else 0 end,
  coalesce(activation_time, 'infinity'::timestamptz);
grant select on next_network_upgrade to anon, authenticated;

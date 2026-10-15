-- Member stacks: which Privy user owns which saved stack.
--
-- Stacks themselves stay public by slug, exactly like anonymous share links. Ownership lives in its
-- own table with RLS on and no policies, and with no grants to the API roles, so the publishable key
-- can neither read nor claim it. Only the web server writes here, with the secret key, after it has
-- verified the user's Privy access token (apps/web/lib/privy.ts, apps/web/lib/stacks.ts).

create table if not exists stack_owners (
  stack_id       uuid primary key references stacks(id) on delete cascade,
  privy_user_id  text not null,                 -- did:privy:...
  created_at     timestamptz not null default now()
);
create index if not exists stack_owners_user_idx on stack_owners (privy_user_id);

alter table stack_owners enable row level security;
revoke all on stack_owners from anon, authenticated;

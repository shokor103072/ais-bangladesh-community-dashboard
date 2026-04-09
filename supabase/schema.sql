-- AIS Bangladesh UTP dashboard
-- Step 2 cloud schema: shared concern desk via Supabase

create table if not exists public.concerns (
  id bigint primary key,
  ticket text not null unique,
  name text not null,
  email text not null,
  category text,
  priority text,
  visibility text default 'private',
  title text,
  message text,
  status text default 'Open',
  assignee text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  replies jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb
);

create index if not exists concerns_updated_at_idx on public.concerns (updated_at desc);
create index if not exists concerns_email_idx on public.concerns (lower(email));
create index if not exists concerns_status_idx on public.concerns (status);

alter table public.concerns enable row level security;

-- Public users may create a concern.
drop policy if exists "concerns_insert_anyone" on public.concerns;
create policy "concerns_insert_anyone"
  on public.concerns
  for insert
  to anon, authenticated
  with check (true);

-- Public users may read only trackable concerns.
drop policy if exists "concerns_select_trackable" on public.concerns;
create policy "concerns_select_trackable"
  on public.concerns
  for select
  to anon, authenticated
  using (visibility = 'trackable');

-- Admin read/update should be done through secure Vercel API routes in the next step.
-- For now, if you still want client-side admin inbox sync, uncomment the two policies below.
-- WARNING: this is convenient but weaker than server-side auth.
--
-- drop policy if exists "concerns_admin_select_all" on public.concerns;
-- create policy "concerns_admin_select_all"
--   on public.concerns
--   for select
--   to anon, authenticated
--   using (true);
--
-- drop policy if exists "concerns_admin_update_all" on public.concerns;
-- create policy "concerns_admin_update_all"
--   on public.concerns
--   for update
--   to anon, authenticated
--   using (true)
--   with check (true);

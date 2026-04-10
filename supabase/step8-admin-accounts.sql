create table if not exists public.admin_accounts (
  id bigint primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_accounts enable row level security;

drop policy if exists "admin_accounts_public_read" on public.admin_accounts;
create policy "admin_accounts_public_read"
  on public.admin_accounts
  for select
  to anon, authenticated
  using (true);

alter publication supabase_realtime add table public.admin_accounts;

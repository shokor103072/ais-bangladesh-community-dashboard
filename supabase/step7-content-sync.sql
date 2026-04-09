create table if not exists public.members_directory (
  id bigint primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.events_board (
  id bigint primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id bigint primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.members_directory enable row level security;
alter table public.events_board enable row level security;
alter table public.gallery_items enable row level security;

drop policy if exists "members_public_read" on public.members_directory;
create policy "members_public_read"
  on public.members_directory
  for select
  to anon, authenticated
  using (true);

drop policy if exists "events_public_read" on public.events_board;
create policy "events_public_read"
  on public.events_board
  for select
  to anon, authenticated
  using (true);

drop policy if exists "gallery_public_read" on public.gallery_items;
create policy "gallery_public_read"
  on public.gallery_items
  for select
  to anon, authenticated
  using (true);

alter publication supabase_realtime add table public.members_directory;
alter publication supabase_realtime add table public.events_board;
alter publication supabase_realtime add table public.gallery_items;

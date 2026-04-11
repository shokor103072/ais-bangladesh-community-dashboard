create table if not exists public.members_directory (
  id bigint primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.committee_directory (
  id bigint primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.alumni_directory (
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

create table if not exists public.achievements_board (
  id bigint primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.members_directory enable row level security;
alter table public.committee_directory enable row level security;
alter table public.alumni_directory enable row level security;
alter table public.events_board enable row level security;
alter table public.achievements_board enable row level security;
alter table public.gallery_items enable row level security;

drop policy if exists "members_public_read" on public.members_directory;
create policy "members_public_read"
  on public.members_directory
  for select
  to anon, authenticated
  using (true);

drop policy if exists "committee_public_read" on public.committee_directory;
create policy "committee_public_read"
  on public.committee_directory
  for select
  to anon, authenticated
  using (true);

drop policy if exists "alumni_public_read" on public.alumni_directory;
create policy "alumni_public_read"
  on public.alumni_directory
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

drop policy if exists "achievements_public_read" on public.achievements_board;
create policy "achievements_public_read"
  on public.achievements_board
  for select
  to anon, authenticated
  using (true);

do $$ begin
  alter publication supabase_realtime add table public.members_directory;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.committee_directory;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.alumni_directory;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.events_board;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.achievements_board;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.gallery_items;
exception when duplicate_object then null; end $$;

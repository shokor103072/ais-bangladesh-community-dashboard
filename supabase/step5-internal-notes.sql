-- Step 5: internal private committee notes for concerns
alter table public.concerns
  add column if not exists internal_notes jsonb not null default '[]'::jsonb;

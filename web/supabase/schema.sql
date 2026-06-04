-- Command View — Phase 1 schema. Run this in the Supabase SQL editor.
-- One JSON document per user; Row Level Security limits each user to their own row.
create table if not exists app_data (
  owner uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_data enable row level security;

create policy app_data_select on app_data
  for select using (auth.uid() = owner);
create policy app_data_insert on app_data
  for insert with check (auth.uid() = owner);
create policy app_data_update on app_data
  for update using (auth.uid() = owner) with check (auth.uid() = owner);

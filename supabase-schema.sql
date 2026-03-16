-- ================================================
-- Trip Planner — Supabase Schema
-- รันใน Supabase Dashboard > SQL Editor
-- ================================================

-- trips table
create table if not exists trips (
  id          uuid default gen_random_uuid() primary key,
  title       text not null default 'Trip ใหม่',
  destination text,
  dates       text,
  notes       text,
  plan_json   jsonb,
  owner_id    uuid references auth.users(id) on delete cascade not null,
  share_code  text unique default substr(md5(random()::text), 1, 8),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Row Level Security
alter table trips enable row level security;

-- Owner has full access
create policy "trips_owner_all" on trips
  for all
  using (owner_id = auth.uid());

-- Enable Realtime (run in SQL Editor)
alter publication supabase_realtime add table trips;

-- ================================================
-- Optional: auto-update updated_at on change
-- ================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trips_updated_at
  before update on trips
  for each row execute function update_updated_at();

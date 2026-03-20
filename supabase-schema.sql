-- Run this entire file in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

create extension if not exists "uuid-ossp";

create table if not exists public.user_data (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, profile_id)
);

create table if not exists public.daily_task_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(user_id, profile_id)
);

create table if not exists public.profiles_state (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_data_updated_at
  before update on public.user_data
  for each row execute procedure public.handle_updated_at();

create trigger daily_task_history_updated_at
  before update on public.daily_task_history
  for each row execute procedure public.handle_updated_at();

create trigger profiles_state_updated_at
  before update on public.profiles_state
  for each row execute procedure public.handle_updated_at();

alter table public.user_data enable row level security;
alter table public.daily_task_history enable row level security;
alter table public.profiles_state enable row level security;

create policy "select own user_data" on public.user_data for select using (auth.uid() = user_id);
create policy "insert own user_data" on public.user_data for insert with check (auth.uid() = user_id);
create policy "update own user_data" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own user_data" on public.user_data for delete using (auth.uid() = user_id);

create policy "select own daily_task_history" on public.daily_task_history for select using (auth.uid() = user_id);
create policy "insert own daily_task_history" on public.daily_task_history for insert with check (auth.uid() = user_id);
create policy "update own daily_task_history" on public.daily_task_history for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own daily_task_history" on public.daily_task_history for delete using (auth.uid() = user_id);

create policy "select own profiles_state" on public.profiles_state for select using (auth.uid() = user_id);
create policy "insert own profiles_state" on public.profiles_state for insert with check (auth.uid() = user_id);
create policy "update own profiles_state" on public.profiles_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own profiles_state" on public.profiles_state for delete using (auth.uid() = user_id);

create index if not exists user_data_user_id_idx on public.user_data(user_id);
create index if not exists daily_task_history_user_id_idx on public.daily_task_history(user_id);
create index if not exists profiles_state_user_id_idx on public.profiles_state(user_id);

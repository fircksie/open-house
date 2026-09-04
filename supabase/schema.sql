-- Open House family schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  family_id uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  match_id text not null,
  selected_player_id text not null,
  match_starts_at timestamptz not null,
  predicted_at timestamptz not null default now(),
  is_underdog_pick boolean not null default false,
  is_correct boolean,
  points integer not null default 0 check (points between 0 and 2),
  unique(profile_id, match_id)
);

create table if not exists public.favourites (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  player_id text not null,
  created_at timestamptz not null default now(),
  primary key(profile_id, player_id)
);

create table if not exists public.reactions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  match_id text not null,
  emoji text not null check (emoji in ('🔥','😬','🎾','👏','💀')),
  created_at timestamptz not null default now(),
  primary key(profile_id, match_id)
);

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.picks enable row level security;
alter table public.favourites enable row level security;
alter table public.reactions enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.picks, public.favourites, public.reactions to authenticated;

create or replace function public.my_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;
create or replace function public.my_family_id()
returns uuid language sql stable security definer set search_path = public as $$
  select family_id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;
revoke all on function public.my_profile_id() from public; grant execute on function public.my_profile_id() to authenticated;
revoke all on function public.my_family_id() from public; grant execute on function public.my_family_id() to authenticated;

create policy "family profiles can be read" on public.profiles for select to authenticated
using (family_id = public.my_family_id());
create policy "own profile can update" on public.profiles for update to authenticated
using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy "family picks can be read" on public.picks for select to authenticated
using (profile_id in (select id from public.profiles where family_id = public.my_family_id()));
create policy "own favourites can be read" on public.favourites for select to authenticated
using (profile_id = public.my_profile_id());
create policy "own favourites can insert" on public.favourites for insert to authenticated
with check (profile_id = public.my_profile_id());
create policy "own favourites can delete" on public.favourites for delete to authenticated
using (profile_id = public.my_profile_id());

create policy "family reactions can be read" on public.reactions for select to authenticated
using (profile_id in (select id from public.profiles where family_id = public.my_family_id()));
create policy "own reactions can insert" on public.reactions for insert to authenticated
with check (profile_id = public.my_profile_id());
create policy "own reactions can update" on public.reactions for update to authenticated
using (profile_id = public.my_profile_id()) with check (profile_id = public.my_profile_id());
create policy "own reactions can delete" on public.reactions for delete to authenticated
using (profile_id = public.my_profile_id());

-- Join by code without exposing the families table.
create or replace function public.join_family(p_display_name text, p_invite_code text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare f public.families; p public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into f from public.families where upper(invite_code)=upper(trim(p_invite_code)) limit 1;
  if f.id is null then raise exception 'Invalid family invite code'; end if;
  insert into public.profiles(auth_user_id,display_name,family_id)
  values(auth.uid(),trim(p_display_name),f.id)
  on conflict(auth_user_id) do update set display_name=excluded.display_name, family_id=excluded.family_id
  returning * into p;
  return p;
end; $$;
revoke all on function public.join_family(text,text) from public; grant execute on function public.join_family(text,text) to authenticated;

-- Enforce the start-time lock in the database as well as the UI.
create or replace function public.submit_pick(p_match_id text, p_selected_player_id text, p_match_starts_at timestamptz, p_is_underdog_pick boolean default false)
returns public.picks
language plpgsql security definer set search_path = public as $$
declare pid uuid; result public.picks;
begin
  pid := public.my_profile_id();
  if pid is null then raise exception 'Join a family first'; end if;
  if now() >= p_match_starts_at then raise exception 'Picks are locked'; end if;
  insert into public.picks(profile_id,match_id,selected_player_id,match_starts_at,is_underdog_pick)
  values(pid,p_match_id,p_selected_player_id,p_match_starts_at,p_is_underdog_pick)
  on conflict(profile_id,match_id) do update set selected_player_id=excluded.selected_player_id, match_starts_at=excluded.match_starts_at, is_underdog_pick=excluded.is_underdog_pick, predicted_at=now()
  returning * into result;
  return result;
end; $$;
revoke all on function public.submit_pick(text,text,timestamptz,boolean) from public; grant execute on function public.submit_pick(text,text,timestamptz,boolean) to authenticated;

-- Casual family app settlement: any family member can trigger settlement after the real result appears in the tennis feed.
create or replace function public.settle_match(p_match_id text, p_winner_player_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  fid := public.my_family_id(); if fid is null then return; end if;
  update public.picks p
  set is_correct = (p.selected_player_id = p_winner_player_id),
      points = case when p.selected_player_id = p_winner_player_id then 1 + case when p.is_underdog_pick then 1 else 0 end else 0 end
  where p.match_id = p_match_id
    and p.profile_id in (select id from public.profiles where family_id = fid);
end; $$;
revoke all on function public.settle_match(text,text) from public; grant execute on function public.settle_match(text,text) to authenticated;

-- Create your family room once. Change the name/code before running if desired.
insert into public.families(name, invite_code)
values ('Fircks US Open', 'FIRCKS26')
on conflict(invite_code) do nothing;

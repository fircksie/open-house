-- Open House consolidated fix
-- Run once in Supabase -> SQL Editor.
-- Safe to run again if the earlier pick-lock patch was already applied.

-- Fixtures can exist before an exact start time is assigned.
alter table public.picks
  alter column match_starts_at drop not null;

-- Do not reject a family pick solely because a provisional scheduled timestamp
-- has passed. The app now locks when the live/status feed says the match is no
-- longer upcoming.
create or replace function public.submit_pick(
  p_match_id text,
  p_selected_player_id text,
  p_match_starts_at timestamptz,
  p_is_underdog_pick boolean default false
)
returns public.picks
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  result public.picks;
begin
  pid := public.my_profile_id();

  if pid is null then
    raise exception 'Join a family first';
  end if;

  insert into public.picks(
    profile_id,
    match_id,
    selected_player_id,
    match_starts_at,
    is_underdog_pick
  )
  values(
    pid,
    p_match_id,
    p_selected_player_id,
    p_match_starts_at,
    p_is_underdog_pick
  )
  on conflict(profile_id, match_id) do update
  set selected_player_id = excluded.selected_player_id,
      match_starts_at = excluded.match_starts_at,
      is_underdog_pick = excluded.is_underdog_pick,
      predicted_at = now()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.submit_pick(text,text,timestamptz,boolean) from public;
grant execute on function public.submit_pick(text,text,timestamptz,boolean) to authenticated;

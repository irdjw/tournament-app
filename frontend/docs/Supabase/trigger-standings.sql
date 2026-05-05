-- Trigger: update standings when a match completes
-- Run this in the Supabase SQL Editor after running updated-schema.sql

-- Write policies needed for the trigger to work (service role bypasses RLS, but add for completeness)
create policy "Public insert" on standings for insert with check (true);
create policy "Public update" on standings for update using (true);

create policy "Public insert" on fixture_pairings for insert with check (true);
create policy "Public update" on fixture_pairings for update using (true);

create policy "Public insert" on fixture_rounds for insert with check (true);
create policy "Public update" on fixture_rounds for update using (true);

-- ─── Function ────────────────────────────────────────────────────────────────

create or replace function update_standings_on_match_complete()
returns trigger
language plpgsql
security definer
as $$
declare
  v_fixture_id    uuid;
  v_home_id       uuid;
  v_away_id       uuid;
  v_home_legs     integer;
  v_away_legs     integer;
begin
  -- Only fire when status transitions to 'complete'
  if new.status != 'complete' or old.status = 'complete' then
    return new;
  end if;

  -- Resolve fixture + players via pairing
  select
    fp.home_player_id,
    fp.away_player_id,
    fr.fixture_id
  into v_home_id, v_away_id, v_fixture_id
  from fixture_pairings fp
  join fixture_rounds fr on fr.id = fp.fixture_round_id
  where fp.match_id = new.id
  limit 1;

  -- Not a league match — do nothing
  if v_fixture_id is null then
    return new;
  end if;

  -- Legs won for each player
  select coalesce(legs_won, 0) into v_home_legs
  from match_players where match_id = new.id and user_id = v_home_id;

  select coalesce(legs_won, 0) into v_away_legs
  from match_players where match_id = new.id and user_id = v_away_id;

  -- Upsert home player row
  insert into standings (fixture_id, user_id, played, wins, losses, legs_for, legs_against, points)
  values (
    v_fixture_id, v_home_id, 1,
    case when v_home_legs > v_away_legs then 1 else 0 end,
    case when v_home_legs < v_away_legs then 1 else 0 end,
    v_home_legs, v_away_legs,
    case when v_home_legs > v_away_legs then 2 else 0 end
  )
  on conflict (fixture_id, user_id) do update set
    played       = standings.played + 1,
    wins         = standings.wins + case when v_home_legs > v_away_legs then 1 else 0 end,
    losses       = standings.losses + case when v_home_legs < v_away_legs then 1 else 0 end,
    legs_for     = standings.legs_for + v_home_legs,
    legs_against = standings.legs_against + v_away_legs,
    points       = standings.points + case when v_home_legs > v_away_legs then 2 else 0 end,
    updated_at   = now();

  -- Upsert away player row
  insert into standings (fixture_id, user_id, played, wins, losses, legs_for, legs_against, points)
  values (
    v_fixture_id, v_away_id, 1,
    case when v_away_legs > v_home_legs then 1 else 0 end,
    case when v_away_legs < v_home_legs then 1 else 0 end,
    v_away_legs, v_home_legs,
    case when v_away_legs > v_home_legs then 2 else 0 end
  )
  on conflict (fixture_id, user_id) do update set
    played       = standings.played + 1,
    wins         = standings.wins + case when v_away_legs > v_home_legs then 1 else 0 end,
    losses       = standings.losses + case when v_away_legs < v_home_legs then 1 else 0 end,
    legs_for     = standings.legs_for + v_away_legs,
    legs_against = standings.legs_against + v_home_legs,
    points       = standings.points + case when v_away_legs > v_home_legs then 2 else 0 end,
    updated_at   = now();

  return new;
end;
$$;

-- ─── Trigger ─────────────────────────────────────────────────────────────────

drop trigger if exists trigger_update_standings on matches;

create trigger trigger_update_standings
after update on matches
for each row
execute function update_standings_on_match_complete();

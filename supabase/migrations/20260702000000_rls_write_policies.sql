-- ─────────────────────────────────────────────────────────────────────────────
-- RLS write policies
--
-- Before this migration the app relied on permissive/absent write policies:
-- anyone holding the anon key (i.e. anyone who opens dev tools on a public
-- page) could insert or modify matches, scores, and tournaments.
--
-- End state:
--   • anon:           read-only on public tables (displays / player pages keep working)
--   • authenticated:  writes allowed only for venue staff/admins
--                     (every bar/admin user gets a venue_admins row — created by
--                      onboarding OnboardingVenue.tsx and scripts/setup-accounts.ts)
--   • platform admins (platform_admins table) can write everything
--
-- NOTE: this migration drops ALL existing policies on the listed tables and
-- recreates a canonical set, so the end state is deterministic. Review any
-- policies you added manually before applying.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Helper functions ────────────────────────────────────────────────────────
-- security definer so policy checks can read the admin tables without
-- recursing into their own RLS.

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_venue_admin(target_venue uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_platform_admin()
      or exists (
        select 1 from venue_admins
        where user_id = auth.uid() and venue_id = target_venue
      );
$$;

-- Any venue staff/admin at all — used for tables that have no direct venue
-- column (players, match children). Tighten these to parent-venue scoping
-- once every row carries a traceable venue.
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_platform_admin()
      or exists (select 1 from venue_admins where user_id = auth.uid());
$$;

create or replace function public.venue_has_admin(target_venue uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from venue_admins where venue_id = target_venue);
$$;

-- ─── Enable RLS + wipe existing policies for a deterministic end state ──────

do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'users', 'venues', 'sports', 'matches', 'match_players', 'match_events',
    'fixtures', 'fixture_rounds', 'fixture_pairings', 'standings',
    'tournaments', 'tournament_groups', 'tournament_participants',
    'tournament_matches', 'stations', 'venue_admins', 'platform_admins'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end $$;

-- ─── Public-read tables (displays, venue pages, player lookup) ──────────────

create policy "Public read" on users                   for select using (true);
create policy "Public read" on venues                  for select using (true);
create policy "Public read" on sports                  for select using (true);
create policy "Public read" on matches                 for select using (true);
create policy "Public read" on match_players           for select using (true);
create policy "Public read" on match_events            for select using (true);
create policy "Public read" on fixtures                for select using (true);
create policy "Public read" on fixture_rounds          for select using (true);
create policy "Public read" on fixture_pairings        for select using (true);
create policy "Public read" on standings               for select using (true);
create policy "Public read" on tournaments             for select using (true);
create policy "Public read" on tournament_groups       for select using (true);
create policy "Public read" on tournament_participants for select using (true);
create policy "Public read" on tournament_matches      for select using (true);
create policy "Public read" on stations                for select using (true);

-- ─── Admin tables: readable only by the user themselves / platform admins ───

create policy "Read own venue admin rows" on venue_admins
  for select using (user_id = auth.uid() or is_platform_admin());

create policy "Read own platform admin row" on platform_admins
  for select using (user_id = auth.uid());
-- No client-side writes to platform_admins — manage via service role only.

-- ─── venues ──────────────────────────────────────────────────────────────────
-- Any authenticated user may create a venue (onboarding); only its admins may
-- change it.

create policy "Authenticated create venue" on venues
  for insert to authenticated with check (true);

create policy "Venue admins update venue" on venues
  for update to authenticated using (is_venue_admin(id));

create policy "Venue admins delete venue" on venues
  for delete to authenticated using (is_venue_admin(id));

-- ─── venue_admins ────────────────────────────────────────────────────────────
-- A user may claim a venue that has no admins yet (onboarding step), and
-- existing venue admins may add more staff.

create policy "Claim unowned venue or be added by admin" on venue_admins
  for insert to authenticated with check (
    is_platform_admin()
    or (user_id = auth.uid() and not venue_has_admin(venue_id))
    or is_venue_admin(venue_id)
  );

create policy "Venue admins manage staff" on venue_admins
  for delete to authenticated using (is_venue_admin(venue_id));

-- ─── users (player records) / sports ─────────────────────────────────────────
-- Walk-up player rows are created by staff from bar mode.

create policy "Staff create players" on users
  for insert to authenticated with check (is_staff());

create policy "Staff update players" on users
  for update to authenticated using (is_staff());

create policy "Staff create sports" on sports
  for insert to authenticated with check (is_staff());

create policy "Staff update sports" on sports
  for update to authenticated using (is_staff());

-- ─── matches + children ──────────────────────────────────────────────────────
-- venue_id is null for legacy casual matches; scoped rows require venue admin.

create policy "Staff write matches" on matches
  for all to authenticated
  using (is_staff() and (venue_id is null or is_venue_admin(venue_id)))
  with check (is_staff() and (venue_id is null or is_venue_admin(venue_id)));

create policy "Staff write match players" on match_players
  for all to authenticated using (is_staff()) with check (is_staff());

create policy "Staff write match events" on match_events
  for all to authenticated using (is_staff()) with check (is_staff());

-- ─── league: fixtures + children ─────────────────────────────────────────────

create policy "Venue admins write fixtures" on fixtures
  for all to authenticated
  using (is_staff() and (venue_id is null or is_venue_admin(venue_id)))
  with check (is_staff() and (venue_id is null or is_venue_admin(venue_id)));

create policy "Staff write fixture rounds" on fixture_rounds
  for all to authenticated using (is_staff()) with check (is_staff());

create policy "Staff write fixture pairings" on fixture_pairings
  for all to authenticated using (is_staff()) with check (is_staff());

create policy "Staff write standings" on standings
  for all to authenticated using (is_staff()) with check (is_staff());

-- ─── tournaments + children (scoped through the parent tournament) ──────────

create policy "Venue admins write tournaments" on tournaments
  for all to authenticated
  using (is_venue_admin(venue_id))
  with check (is_venue_admin(venue_id));

create policy "Venue admins write tournament groups" on tournament_groups
  for all to authenticated
  using (exists (select 1 from tournaments t where t.id = tournament_id and is_venue_admin(t.venue_id)))
  with check (exists (select 1 from tournaments t where t.id = tournament_id and is_venue_admin(t.venue_id)));

create policy "Venue admins write tournament participants" on tournament_participants
  for all to authenticated
  using (exists (select 1 from tournaments t where t.id = tournament_id and is_venue_admin(t.venue_id)))
  with check (exists (select 1 from tournaments t where t.id = tournament_id and is_venue_admin(t.venue_id)));

create policy "Venue admins write tournament matches" on tournament_matches
  for all to authenticated
  using (exists (select 1 from tournaments t where t.id = tournament_id and is_venue_admin(t.venue_id)))
  with check (exists (select 1 from tournaments t where t.id = tournament_id and is_venue_admin(t.venue_id)));

-- ─── stations ────────────────────────────────────────────────────────────────

create policy "Venue admins write stations" on stations
  for all to authenticated
  using (is_venue_admin(venue_id))
  with check (is_venue_admin(venue_id));

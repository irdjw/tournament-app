-- Drop and recreate fixtures with the fuller schema
alter table fixtures 
  add column if not exists day_of_week integer,
  add column if not exists start_time text,
  add column if not exists season_start date,
  add column if not exists season_end date,
  add column if not exists active boolean default true;

-- FIXTURE ROUNDS
create table if not exists fixture_rounds (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures(id),
  round_number integer not null,
  played_on date,
  status text default 'scheduled',
  created_at timestamp default now()
);

-- FIXTURE PAIRINGS
create table if not exists fixture_pairings (
  id uuid primary key default gen_random_uuid(),
  fixture_round_id uuid references fixture_rounds(id),
  match_id uuid references matches(id),
  home_player_id uuid references users(id),
  away_player_id uuid references users(id),
  station text,
  created_at timestamp default now()
);

-- Drop and recreate standings with fuller schema
drop table if exists standings;
create table standings (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures(id),
  user_id uuid references users(id),
  played integer default 0,
  wins integer default 0,
  losses integer default 0,
  legs_for integer default 0,
  legs_against integer default 0,
  points integer default 0,
  updated_at timestamp default now(),
  unique(fixture_id, user_id)
);

-- TOURNAMENTS
create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id),
  sport_id uuid references sports(id),
  name text not null,
  format text not null,
  status text default 'setup',
  config jsonb,
  created_at timestamp default now()
);

-- TOURNAMENT GROUPS
create table if not exists tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id),
  name text,
  group_type text default 'winners',
  created_at timestamp default now()
);

-- TOURNAMENT PARTICIPANTS
create table if not exists tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id),
  user_id uuid references users(id),
  seed integer,
  group_id uuid references tournament_groups(id),
  status text default 'active',
  created_at timestamp default now()
);

-- TOURNAMENT MATCHES
create table if not exists tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id),
  group_id uuid references tournament_groups(id),
  match_id uuid references matches(id),
  round integer not null,
  position integer not null,
  player_a_id uuid references users(id),
  player_b_id uuid references users(id),
  winner_id uuid references users(id),
  loser_id uuid references users(id),
  next_match_id uuid references tournament_matches(id),
  loser_next_match_id uuid references tournament_matches(id),
  station text,
  status text default 'pending',
  created_at timestamp default now()
);

-- STATIONS
create table if not exists stations (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id),
  name text not null,
  sport_id uuid references sports(id),
  status text default 'available',
  current_match_id uuid references matches(id),
  created_at timestamp default now()
);

-- Realtime
alter publication supabase_realtime add table fixture_rounds;
alter publication supabase_realtime add table fixture_pairings;
alter publication supabase_realtime add table standings;
alter publication supabase_realtime add table tournament_matches;
alter publication supabase_realtime add table stations;

-- RLS
alter table fixture_rounds enable row level security;
alter table fixture_pairings enable row level security;
alter table standings enable row level security;
alter table tournaments enable row level security;
alter table tournament_groups enable row level security;
alter table tournament_participants enable row level security;
alter table tournament_matches enable row level security;
alter table stations enable row level security;

create policy "Public read" on fixture_rounds for select using (true);
create policy "Public read" on fixture_pairings for select using (true);
create policy "Public read" on standings for select using (true);
create policy "Public read" on tournaments for select using (true);
create policy "Public read" on tournament_groups for select using (true);
create policy "Public read" on tournament_participants for select using (true);
create policy "Public read" on tournament_matches for select using (true);
create policy "Public read" on stations for select using (true);
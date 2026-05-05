-- Users (auth handled by Supabase, but we reference them)
create table users (
  id uuid primary key default auth.uid(),
  email text unique,
  name text,
  role text default 'player', -- 'player', 'staff', 'admin'
  venue_id uuid,
  created_at timestamp default now()
);

-- Venues
create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  timezone text default 'Europe/London',
  created_at timestamp default now()
);

-- Sports
create table sports (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- 'darts', 'pool'
  created_at timestamp default now()
);

-- Matches
create table matches (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id),
  sport_id uuid references sports(id),
  match_type text, -- 'casual', 'league', 'tournament'
  status text default 'pending', -- 'pending', 'in_progress', 'complete'
  created_at timestamp default now(),
  completed_at timestamp
);

-- Match players
create table match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id),
  user_id uuid references users(id),
  team_id text, -- 'team_a' or 'team_b'
  created_at timestamp default now()
);

-- Match events (score updates)
create table match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id),
  user_id uuid references users(id),
  event_type text, -- 'visit' (darts), 'frame_win' (pool)
  visit_number integer,
  score_value integer,
  remaining_score integer,
  metadata jsonb, -- {180s, busts, checkouts, etc}
  created_at timestamp default now()
);

-- Fixtures (recurring league nights)
create table fixtures (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id),
  sport_id uuid references sports(id),
  name text,
  day_of_week integer, -- 0-6 (Sunday-Saturday)
  time text,
  created_at timestamp default now()
);

-- Standings (league tables)
create table standings (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures(id),
  user_id uuid references users(id),
  wins integer default 0,
  losses integer default 0,
  points integer default 0,
  updated_at timestamp default now()
);

-- Enable RLS if desired
alter table users enable row level security;
alter table matches enable row level security;
alter table match_events enable row level security;
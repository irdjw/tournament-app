-- Migration: Add legs tracking to matches
-- Run this in Supabase SQL Editor

-- Add legs configuration to matches
alter table matches add column if not exists legs_to_win integer default 1;
alter table matches add column if not exists current_leg integer default 1;

-- Add leg tracking to match_players (track legs won per player)
alter table match_players add column if not exists legs_won integer default 0;

-- Add leg number to match_events
alter table match_events add column if not exists leg_number integer default 1;

-- Update existing matches to have proper leg values
update matches set legs_to_win = 1, current_leg = 1 where legs_to_win is null;
update match_players set legs_won = 0 where legs_won is null;
update match_events set leg_number = 1 where leg_number is null;

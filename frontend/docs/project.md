# Pub Sports App - MVP

## Customer Zero
- **Venue**: The Southfield
- **Sports**: Darts, Pool
- **Goal**: One full league night + casual competitions, scalable architecture

## Three Modes
1. **Casual** - Walk-up matches, no accounts required, quick result entry
2. **League** - Recurring weekly fixtures, league table, season management
3. **Tournament** - Bracketed events, single or double elimination, round robin, double round robin, 

## Three Surfaces
1. **Bar Mode** (tablet/phone behind bar) - Venue staff run matches
2. **Player Mode** (any phone) - Players join, view results, check standings
3. **Display Mode** (TV or large screen) - Live scores, leaderboards, next match

## Sports Rules (Darts & Pool)

### Darts
- Format: Legs (best of N), Sets (optional)
- Starting score: 501 (configurable)
- Double in required / Double out required (configurable)
- Stats tracked: 3-dart average, 180s, checkouts, first 9, bust count
- Scoring: per-visit (3 darts), auto-subtract, validation

### Pool
- Format: Frames (best of N)
- Game type: 8-ball (stripes/solids), 9-ball
- Stats tracked: break score, runs, fouls
- Scoring: per-table result (win/loss/foul)

## Database Schema (MVP - Darts focus first)

### Core Tables
- `users` - players and venue staff (id, email, name, role)
- `venues` - pubs/clubs (id, name, address, timezone)
- `sports` - sport definitions (id, name, rules_config)
- `matches` - individual games (id, sport_id, match_type, status)
- `match_players` - participants in a match (id, match_id, user_id, team)
- `match_events` - score updates (id, match_id, visit/frame/turn, score, timestamp)
- `fixtures` - recurring league nights (id, venue_id, day_of_week, sport_id)
- `standings` - league tables (id, fixture_id, player_id, wins, losses, points)

## Tech Stack
- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes + Supabase
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Netlify (frontend + edge functions)
- **Auth**: Supabase Auth
- **Real-time**: Supabase Realtime subscriptions
- **Testing**: Browser pages in GitHub before PWA

## MVP Scope (This Week)
1. Supabase schema for darts (matches, players, scoring events)
2. Bar Mode UI - Create match, enter scores (darts focus)
3. Display Mode UI - Live scoreboard showing current match + league table
4. Player Mode UI - View results, league standings
5. Real-time updates via Supabase subscriptions
6. One full league night end-to-end working

## Not in MVP
- Authentication beyond basic anonymous/email
- Pool (darts first, pool second)
- Tournaments (league mode only)
- Mobile app shells (PWA web only)
- Payment processing
- Admin dashboard

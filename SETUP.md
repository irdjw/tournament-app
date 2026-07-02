# Darts Tournament App - Setup Guide

## Phase 1, 2, 3 & 4 Complete! 🎯

### What's Working
- ✅ Supabase connection
- ✅ Bar Mode: Match setup with legs selection (Best of 3, 5, 7, 9)
- ✅ Bar Mode: Live scoring (keypad, 501 countdown, bust validation, undo)
- ✅ Bar Mode: Multi-leg matches with automatic progression
- ✅ Display Mode: Live scoreboard with real-time updates
- ✅ Display Mode: Shows leg scores and match queue
- ✅ Player Mode: Player stats and match history
- ✅ Standings: League table with rankings

## Setup Instructions

### 1. Create Database Schema
1. Go to your Supabase project dashboard
2. Open the SQL Editor
3. Copy and paste the contents of `frontend/docs/Supabase/schema.sql`
4. Run the SQL to create all tables
5. **IMPORTANT**: Run the migration for legs tracking:
   - Copy and paste `frontend/docs/Supabase/migration-legs.sql`
   - Run it in SQL Editor

### 2. Verify Environment
Check that `frontend/.env` has your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install Dependencies (Already Done)
```bash
cd frontend
npm install
```

### 4. Start Development Server
```bash
cd frontend
npm run dev
```

The app will be available at http://localhost:5175

## How to Use

### Bar Mode (Tablet/Phone)
1. Go to the home page
2. Click "Bar Mode"
3. Enter two player names
4. **Select match format** (Best of 3, 5, 7, or 9)
5. Click "Start Match"
6. Use the keypad to enter scores:
   - Enter 3-digit score (0-180)
   - Click "Submit" to log the score
   - Scores auto-subtract from 501
   - Bust on negative or exactly 1
   - Click "Undo Last" to undo mistakes
7. When a player reaches 0:
   - They win that leg
   - Leg counter updates
   - Game resets to 501 for next leg
8. First player to win required legs wins the match!

### Display Mode (TV Screen)
1. Open a browser window
2. Go to home page and click "Display Mode"
3. Shows current match with:
   - Live scores updating automatically
   - Leg counts for each player
   - Match format (Best of X)
   - Current leg number
   - Queue of upcoming matches
4. Auto-updates when:
   - Scores change
   - Legs complete
   - Matches finish

### Player Stats
1. Go to home page and click "Player Stats"
2. Enter a player name and search
3. View:
   - Total matches, wins, losses
   - Win rate
   - Average 3-dart score
   - Complete match history
   - Individual match statistics

### Standings
1. Go to home page and click "Standings"
2. View league table with:
   - Current rankings (sorted by points)
   - Match record (W-L)
   - Leg difference
   - Win percentage
   - Points (2 per win)

## Features

### Match Formats
- **Single Leg**: First to 1
- **Best of 3**: First to 2 legs
- **Best of 5**: First to 3 legs
- **Best of 7**: First to 4 legs
- **Best of 9**: First to 5 legs

### Statistics Tracked
- 3-dart average per match
- Highest score per match
- Total visits (turns)
- Legs won/lost
- Match wins/losses
- Leg difference
- Win percentage

### Real-time Features
- Live score updates on display
- Automatic leg progression
- Match queue display
- Instant standings updates

## Tech Stack
- Frontend: Vite + React
- Database: Supabase (PostgreSQL)
- Real-time: Supabase Realtime subscriptions
- Routing: React Router

## Testing Scenarios

### Test 1: Best of 5 Match
1. Create match: "Alice" vs "Bob", Best of 5
2. Play first leg to completion
3. Watch leg counter update
4. Continue until someone wins 3 legs
5. Check standings are updated

### Test 2: Multiple Matches
1. Create several matches with different players
2. Complete some matches
3. Go to Standings page
4. Verify rankings are correct

### Test 3: Player Stats
1. Complete multiple matches for one player
2. Go to Player Stats
3. Search for that player
4. Verify win/loss record and statistics

### Test 4: Real-time Display
1. Open Bar Mode in one window
2. Open Display Mode in another window
3. Score a multi-leg match
4. Watch Display Mode update:
   - Scores change live
   - Leg counters update
   - New leg starts automatically

## Security: Row Level Security policies

**Apply `supabase/migrations/20260702000000_rls_write_policies.sql` in the SQL
Editor (or via `supabase db push`).** Without it, anyone holding the anon key
can write to every table. The migration keeps all public pages read-only
working, and restricts writes to authenticated venue staff:

- Every bar/admin user must have a `venue_admins` row — onboarding and
  `scripts/setup-accounts.ts` both create one.
- It drops and recreates all policies on the app tables, so review any
  hand-added policies first.

## Database Schema Updates

The app now tracks:
- `matches.legs_to_win`: Required legs to win match
- `matches.current_leg`: Current leg number
- `match_players.legs_won`: Legs won by each player
- `match_events.leg_number`: Which leg the event belongs to

## Future Enhancements
- Tournament brackets
- Pool (8-ball/9-ball) support
- More detailed statistics (180s, checkouts, first 9 average)
- Player profiles with photos
- Venue management
- Season management
- Mobile PWA

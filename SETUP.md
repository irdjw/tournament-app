# Darts Tournament App - Setup Guide

## Phase 1 & 2 Complete! 🎯

### What's Working
- ✅ Supabase connection
- ✅ Bar Mode: Match setup (create matches with 2 players)
- ✅ Bar Mode: Live scoring (keypad, 501 countdown, bust validation, undo)
- ✅ Display Mode: Live scoreboard with real-time updates

## Setup Instructions

### 1. Create Database Schema
1. Go to your Supabase project dashboard
2. Open the SQL Editor
3. Copy and paste the contents of `frontend/docs/Supabase/schema.sql`
4. Run the SQL to create all tables

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

## How to Use

### Bar Mode (Tablet/Phone)
1. Go to http://localhost:5173
2. Click "Bar Mode"
3. Enter two player names
4. Click "Start Match"
5. Use the keypad to enter scores:
   - Enter 3-digit score (0-180)
   - Click "Submit" to log the score
   - Scores auto-subtract from 501
   - Bust on negative or exactly 1
   - Click "Undo Last" to undo mistakes
6. First player to reach exactly 0 wins!

### Display Mode (TV Screen)
1. Open a second browser window
2. Go to http://localhost:5173/display/scoreboard
3. Leave it open - it will show the current match live
4. Updates automatically as scores are entered in Bar Mode

## What's Next (Phase 3 & 4)

### Phase 3: Enhanced Display
- Queue of upcoming matches
- League table display
- Match statistics (averages, 180s)

### Phase 4: Player Mode
- Player profiles
- Match history
- League standings
- Personal statistics

## Tech Stack
- Frontend: Vite + React
- Database: Supabase (PostgreSQL)
- Real-time: Supabase Realtime subscriptions
- Routing: React Router

## Testing the App

### Test Scenario 1: Simple Match
1. Start a match: "Alice" vs "Bob"
2. Enter scores: 60, 45, 81, 100
3. Check Display Mode updates live
4. Test undo button
5. Play until someone wins

### Test Scenario 2: Bust Detection
1. Player has 150 remaining
2. Enter score of 151 (bust - negative)
3. Score should stay at 150
4. Player has 2 remaining
5. Enter any score (bust - can't leave exactly 1)

### Test Scenario 3: Real-time Sync
1. Open Bar Mode in one window
2. Open Display Mode in another
3. Enter scores in Bar Mode
4. Watch Display Mode update automatically

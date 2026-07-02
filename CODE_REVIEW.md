# Codebase Review — tournament-app

*Reviewed: July 2026. Scope: full `frontend/` app (~16,000 lines of source), schema docs, scripts, config.*

## Snapshot

| Check | Result |
|---|---|
| Unit tests (`npm test`) | ✅ 173 passing |
| TypeScript (`npx tsc --noEmit`) | ❌ ~20 errors (never run by the build) |
| ESLint (`npm run lint`) | ❌ 14 errors, 6 warnings |
| Build (`npm run build`) | `vite build` only — no typecheck |

The foundations are genuinely good: the pure logic in `lib/darts.ts`, `lib/standings.ts`, `lib/pool.ts` and the bracket math in `lib/tournaments.ts` is clean, documented, and well-tested. The newer Tailwind pages (tournament wizard, control, venue/display pages) are well-structured. The problems are concentrated in three places: **the old MVP pages were never brought up to the new standard**, **the scoring page doesn't use the rules engine at all**, and **several flows are only correct when exactly one person has the right page open**.

---

## 1. Critical correctness issues (logic flow)

### 1.1 The scoring page ignores the rules engine and the match config
`pages/bar/Scoring.jsx` is the heart of bar mode, and it:

- Hardcodes `STARTING_SCORE = 501` (line 6). A tournament configured for 301 still scores from 501. `config.startingScore` is collected in the wizard, stored in the DB, and never read.
- Never imports `lib/darts.ts`. `isBust()`, `applyScore()`, `getCheckout()` — the tested rules engine — are dead code in the real scoring path.
- Applies double-out bust rules unconditionally (`newScore === 1` is always a bust, line 149) even when the match was configured with `doubleOut: false`, and conversely never validates that a checkout actually ended on a double.
- Shows no checkout suggestions despite `getCheckout()` existing precisely for that.
- `lib/stations.ts:getScoresForMatch` hardcodes 501 as well (lines 135, 148), so TV displays have the same problem.

**Fix first.** Load the match/tournament config, thread `startingScore`/`doubleOut` through, and route every score entry through `applyScore()`/`isBust()`. This is the single highest-value change in the repo.

### 1.2 Double elimination is offered but not implemented
The wizard offers "Double Elimination — Two losses = eliminated". What actually happens:

- `generateTournamentStructure` creates an **empty** Losers Bracket group with a comment: *"Losers bracket matches are created on-demand via recordTournamentMatchResult"* (`lib/tournaments.ts:550`).
- `recordTournamentMatchResult` is a one-line wrapper around `advanceWinner`, which never creates losers-bracket matches, never reads `loser_next_match_id`, and marks every loser `eliminated` (lines 785–890).

So a "double elimination" tournament silently runs as single elimination with an empty extra group. Either implement loser routing + grand final, or remove the option from the wizard until it exists.

### 1.3 Result propagation only happens while a staff member has the page open
When a match completes, nothing advances the bracket server-side. `TournamentControl.syncCompletedMatches` polls in-progress matches on each load and calls `recordTournamentMatchResult` from the browser. Consequences:

- If the control page isn't open, completed matches never advance.
- Two open tabs (bar tablet + admin phone) both run the sync on every realtime event → duplicate `advanceWinner` calls racing each other. The completion counting (`.neq('status','complete')` count, line 854) is also read-then-write racy.
- Winner detection orders by `legs_won desc` and takes row 0 (`TournamentControl.tsx:225–234`) — a tie (abandoned match) picks an arbitrary winner.

**Recommendation:** move propagation into the database — a trigger on `matches.status = 'complete'` or a Supabase RPC (`advance_winner(tournament_match_id)`) that does the whole advance in one transaction. The client then just displays state.

### 1.4 Parallel-bracket completion can crown the wrong champion
In `advanceWinner`, when the last remaining match completes, the winner of *that match* gets participant status `'won'` (lines 860–870). In the Southfield format both a Winners and Losers bracket run in parallel — if the losers final finishes last, the losers-bracket winner is recorded as the tournament champion.

### 1.5 Multi-step setup with no transaction
`generateTournamentStructure` → `generateGroupStage` / `insertAndWireBracket` performs dozens of sequential inserts/updates (participants one-by-one, `next_match_id` wired one UPDATE per match, underlying matches created per pair). Any mid-way failure leaves a half-created tournament with no cleanup path, and the sequential awaits make setup slow on pub Wi-Fi. Batch the writes, compute `next_match_id` relationships before insert where possible, and ideally wrap the whole thing in a Postgres function so it's atomic.

### 1.6 Multi-tenancy is half-finished
Admin and venue pages scope by `venue_id` correctly. Bar mode does not:

- `getOrCreateDefaultVenue()` (duplicated in `lib/tournaments.ts` and `lib/fixtures.js`) selects **the first venue row in the table**. The moment a second venue signs up, its tournaments land in someone else's venue.
- `MatchSetup.jsx` creates matches with **no `venue_id` at all** (line 74–84).
- `lib/stations.ts:getAllStations` / `getUnassignedMatches` fetch across all venues and are used by bar pages.

The auth layer already knows the venue (`useAuth().venue`). Thread it through bar mode and delete the "default venue" helpers.

### 1.7 The `@temp.com` player identity hack
`getOrCreateUser` (implemented three separate times: `lib/tournaments.ts`, `lib/fixtures.js`, and inline twice in `MatchSetup.jsx`) synthesises `bobsmith@temp.com` and upserts on email. "Bob Smith" and "Bob smith" collide with any distinct player whose name normalises the same; renames create duplicates; and walk-up players share the `users` table with authenticated accounts. Prefer a `players` table keyed per venue (`venue_id + display_name`), and one shared helper.

### 1.8 Smaller logic issues
- **Bracket preview lies for non-power-of-2 fields**: `StepReview` pairs `players[m]` vs `players[n-1-m]` (NewTournament.tsx:417–427), but the real generator (`bracketSeeds`) gives byes to top seeds. With 6 players the preview shows `1v6, 2v5, 3v4`; the actual bracket is `1 (bye), 4v5, 2 (bye), 3v6`.
- **Leg start never alternates**: `Scoring.jsx` always starts each leg at `players[0]`; darts convention alternates the thrower each leg.
- **Undo can't cross a leg boundary**: once a leg completes the page reloads with only the new leg's events; a mis-entered leg-winning score is unrecoverable from the UI.
- **`threeDartAverage`** divides by non-bust visits only — busts consume darts too, so averages read slightly high.
- **`addParticipant` seed assignment** does a count-then-insert; two concurrent adds get the same seed.

---

## 2. GUI

### 2.1 Two design systems in one app
18 pages (256 `style={{…}}` occurrences) are inline-styled, light-theme, first-generation MVP code: `Scoring.jsx`, `MatchSetup.jsx`, `Scoreboard.jsx`, `PlayerLookup.jsx`, `Standings.jsx`, `StandingsPublic.jsx`, the `bar/league/*` pages. Everything newer is Tailwind, dark, amber-accented. The seam is jarring in the middle of the core flow: tap the dark amber "Score →" button in TournamentControl and land on a white default-font scoring page. Migrating those 18 pages to the Tailwind dark theme is the biggest visible GUI win, and `Scoring.jsx` should be first since it's the screen staff stare at all night.

### 2.2 `alert()` / `confirm()` everywhere
23 call sites use native dialogs — including match wins ("X wins the match!") and leg transitions in `Scoring.jsx`, destructive confirms in Settings/Admin, and error reporting across all admin pages. On a bar tablet these are ugly, blocking, and easy to mis-tap. Build a small `Toast` + `ConfirmDialog` pair and sweep them out. A leg/match win deserves a proper full-screen celebratory overlay, not `alert()`.

### 2.3 No shared component library
Every page re-implements buttons, cards, badges, empty states, and loading screens (the `StatusBadge` in TournamentControl, the step indicator in NewTournament, etc. are all page-local). The Tailwind class strings for "primary amber button" and "gray card" are copy-pasted dozens of times. Extract `components/ui/` — `Button`, `Card`, `Badge`, `PageSpinner`, `EmptyState`, `Toast`, `ConfirmDialog` — and the app instantly gets consistent and much cheaper to restyle. `lucide-react` is installed but emoji (🏆 ⚡ ✓ ⠿ ✕) are used as icons; pick one.

### 2.4 Scoring screen UX (the money screen)
Beyond restyling, the scoring page is missing the things dart players expect:
- **Checkout suggestions** when ≤170 (`getCheckout()` already returns the string).
- **Quick-score buttons** for common visits (26, 41, 45, 60, 85, 100, 140, 180) beside the keypad.
- **Visit history** for the current leg on screen (it's in state already, never rendered).
- **Running 3-dart average / darts thrown** per player.
- Bust feedback via an inline flash rather than an error banner that shares space with real errors.

### 2.5 Other GUI notes
- Loading states vary from `<div>Loading match...</div>` (unstyled, light) to styled dark spinners — fold into `PageSpinner`.
- Color is the only state signal in several places (current thrower = green border); add a text/icon cue for accessibility.
- `App.jsx` imports all ~55 pages eagerly — one bundle for TV displays, bar tablets, and public phones. `React.lazy` per route group (bar/admin/display/public) would cut initial load substantially.

---

## 3. Build health & type safety

- **The build never typechecks.** `build` is `vite build`; `npx tsc --noEmit` currently fails with ~20 errors, at least one of which is a real interface violation (`NewTournament.tsx:39,520` omits the required `advanceFromGroup` from `TournamentConfig` — runtime defaults happen to mask it). Others: `.at()` used while `tsconfig` lib targets pre-ES2022, unsafe `as` casts around Supabase joins, `RefObject` mismatches. Fix the errors, then add `tsc -b &&` to the build script (or CI) so they can't come back.
- **Lint is red**: 14 errors (unused vars, hook-dependency issues that are real stale-closure bugs, e.g. `subscribeToUpdates` in PlayerLookup). Same treatment: fix, then enforce in CI.
- **Mixed JS/TS**: 8 page files plus `lib/fixtures.js`, `lib/supabase.js`, `App.jsx`, `main.jsx` remain untyped. Converting `fixtures.js` and `supabase.js` first gives typing where it matters (DB access).
- **No generated DB types**: every Supabase result is cast with `as unknown as X`. `supabase gen types typescript` (or the MCP generator) would replace most of the casts and catch schema drift at compile time.
- **No CI at all** — no workflow files. A single GitHub Action running `tsc`, `eslint`, `jest` on PRs would have caught most of section 3.

---

## 4. Security

- **Writes are wide open.** All inserts/updates go straight from the browser with the anon key. The schema docs (`docs/Supabase/*.sql`) enable RLS with *only* `Public read` SELECT policies and no write policies — meaning the live database must be running with permissive/disabled write RLS for the app to function. As deployed, anyone with the anon key (i.e. anyone who opens dev tools) can create, modify, or delete matches, scores, and tournaments for any venue. The auth infrastructure (`venue_admins`, `platform_admins`) already exists — enforce it in RLS: public read stays, writes require an authenticated `venue_admin` of the row's venue.
- The schema `.sql` files in `docs/` clearly drift from the real database (e.g. `schema.sql` enables RLS on `users`/`matches`/`match_events` with zero policies, which would break the app if applied). Move to real, ordered migrations (`supabase/migrations/`) as the single source of truth.
- Admin "mode" and venue impersonation live in `localStorage` (`useAuth.ts`) — fine as UI state, but make sure no server-side authorization ever depends on them (with RLS in place it won't).

---

## 5. Architecture / duplication cleanup

- **Three copies of get-or-create helpers** (`getOrCreateUser` ×3, venue/sport helpers ×2) — consolidate into `lib/players.ts` / delete once venue comes from auth context.
- **`useTournament` exists but the main consumer doesn't use it**: `TournamentControl` hand-rolls the same load + realtime-channel logic. Also `useActiveTournamentMatches`/`useBracket` each call `useTournament`, so one page can open multiple identical realtime channels. Consolidate on the hook, and pass data down instead of re-subscribing.
- **`useAuth` is a per-component hook, not a provider**: every mount re-runs `getSession` + two profile queries and registers its own `onAuthStateChange` listener. Wrap it in an `AuthProvider` context once at the root.
- **Realtime channels without venue filters**: e.g. `Scoreboard.jsx` and `GodDashboard` subscribe to all `matches`/`match_events` changes; every score entered at any venue re-fires every open display. Add `filter:` clauses like the tournament channels already do.
- **`recordTournamentMatchResult(tmId, winner, loser)`** takes a `loserId` it ignores — trim the API or use it.
- `docs/project.md` says the stack is Next.js; it's Vite + React Router. Update the doc (and `README.md`) so contributors aren't misled.

---

## 6. Testing gaps

The pure-logic coverage is strong. What's missing is coverage where the bugs actually are:

1. **No test touches `Scoring.jsx`** — the page with the most real-money logic (bust handling, leg/match completion, undo). Extracting its logic into a `useScoringEngine` hook (built on `lib/darts.ts`) would make it testable and fix §1.1 in the same motion.
2. **No tests for `advanceWinner` / `syncCompletedMatches`** orchestration (§1.3, §1.4).
3. The integration suite runs against mocks — fine, but a smoke test against a local Supabase (CLI) would catch RLS/schema drift.

---

## Suggested order of attack

1. **Wire `lib/darts.ts` into the scoring page** + respect `startingScore`/`doubleOut` (correctness of the core loop). Extract `useScoringEngine` + tests.
2. **RLS write policies** (venue-admin-scoped writes). Biggest security hole, cheap to fix since auth tables exist.
3. **Fix the ~20 `tsc` errors + 14 lint errors**, then gate the build/CI on both.
4. **Move bracket advancement server-side** (trigger or RPC); make it idempotent; fix parallel-bracket champion detection.
5. **Remove or implement double elimination.**
6. **Venue-scope bar mode** (venue from `useAuth`, delete default-venue helpers, add `venue_id` to casual matches); consolidate the player-creation helper.
7. **UI kit + migrate the 18 inline-style pages** to the Tailwind dark theme, starting with Scoring; replace `alert`/`confirm` with Toast/ConfirmDialog.
8. Route-level code splitting, `AuthProvider`, generated Supabase types, realtime channel filters.

Items 1–5 are correctness/security; 6–8 are polish that will pay for itself in every future feature.

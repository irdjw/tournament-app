import type { Tournament, TournamentMatch, TournamentGroup, Player, TournamentConfig } from '../src/lib/tournaments'
import type { StandingRow } from '../src/lib/standings'
import type { VisitRecord } from '../src/lib/darts'

let _idCounter = 0
function uid(prefix = 'id'): string {
  return `${prefix}-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Venue / Sport ────────────────────────────────────────────────────────────

export function makeVenueId(): string { return uid('venue') }
export function makeSportId(): string { return uid('sport') }

// ─── Players ──────────────────────────────────────────────────────────────────

export function makePlayer(overrides: Partial<Player> = {}): Player {
  return { id: uid('player'), name: 'Test Player', ...overrides }
}

export function makePlayers(count: number, namePrefix = 'Player'): Player[] {
  return Array.from({ length: count }, (_, i) =>
    makePlayer({ name: `${namePrefix} ${i + 1}` })
  )
}

// ─── Tournament ───────────────────────────────────────────────────────────────

const defaultConfig: TournamentConfig = {
  legs: 3,
  startingScore: 501,
  doubleOut: true,
  groupSize: 4,
  advanceFromGroup: 2,
}

export function makeTournamentConfig(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return { ...defaultConfig, ...overrides }
}

export function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: uid('tournament'),
    name: 'Test Tournament',
    format: 'single_elimination',
    status: 'setup',
    sport_id: makeSportId(),
    venue_id: makeVenueId(),
    config: makeTournamentConfig(),
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export function makeGroup(overrides: Partial<TournamentGroup> = {}): TournamentGroup {
  return {
    id: uid('group'),
    tournament_id: uid('tournament'),
    name: 'Group A',
    group_type: 'group',
    ...overrides,
  }
}

// ─── Matches ──────────────────────────────────────────────────────────────────

export function makeMatch(overrides: Partial<TournamentMatch> = {}): TournamentMatch {
  return {
    id: uid('tmatch'),
    tournament_id: uid('tournament'),
    group_id: null,
    match_id: null,
    round: 1,
    position: 1,
    player_a_id: uid('player'),
    player_b_id: uid('player'),
    winner_id: null,
    loser_id: null,
    next_match_id: null,
    loser_next_match_id: null,
    station: null,
    status: 'pending',
    ...overrides,
  }
}

// ─── Standings ────────────────────────────────────────────────────────────────

export function makeStanding(overrides: Partial<StandingRow> = {}): StandingRow {
  const won   = overrides.won   ?? 0
  const drawn = overrides.drawn ?? 0
  const lost  = overrides.lost  ?? 0
  return {
    userId:       uid('user'),
    name:         'Test Player',
    played:       won + drawn + lost,
    won,
    drawn,
    lost,
    legsFor:      0,
    legsAgainst:  0,
    points:       won * 2 + drawn,
    ...overrides,
  }
}

// ─── Darts visits ─────────────────────────────────────────────────────────────

export function makeVisit(overrides: Partial<VisitRecord> = {}): VisitRecord {
  return {
    visitNumber: 1,
    score: 60,
    remaining: 441,
    bust: false,
    ...overrides,
  }
}

export function makeVisitSequence(
  startingScore: number,
  scores: number[],
  doubleOut = true,
): VisitRecord[] {
  const { applyScore } = require('../src/lib/darts')
  let remaining = startingScore
  return scores.map((score, i) => {
    const { remaining: next, bust } = applyScore(remaining, score, doubleOut)
    const visit: VisitRecord = { visitNumber: i + 1, score, remaining: bust ? remaining : next, bust }
    if (!bust) remaining = next
    return visit
  })
}

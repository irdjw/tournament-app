import { supabase } from './supabase'
import { isBust } from './darts'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Per-match darts scoring rules. Stored on the tournament config; casual and
 *  league matches fall back to the defaults. */
export interface ScoringConfig {
  startingScore: number
  doubleOut: boolean
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  startingScore: 501,
  doubleOut: true,
}

/** The subset of a match_events row the engine needs to rebuild leg state. */
export interface ScoringEvent {
  user_id: string
  remaining_score: number
}

export type VisitOutcome =
  | { kind: 'invalid'; reason: string }
  | { kind: 'bust'; remaining: number }
  | { kind: 'leg_win' }
  | { kind: 'score'; remaining: number }

// ─── Pure engine ──────────────────────────────────────────────────────────────

/**
 * Visit totals that cannot be scored with three darts.
 * (Every other value from 0 to 180 is achievable.)
 */
const IMPOSSIBLE_VISIT_SCORES = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179])

/** Returns true if `score` is a total a player can actually throw in one visit. */
export function isValidVisitScore(score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= 180 && !IMPOSSIBLE_VISIT_SCORES.has(score)
}

/**
 * Evaluates a whole-visit total against the current remaining score.
 * Single entry point for score submission — validation, bust detection
 * (double-out aware), and leg-win detection in one place.
 */
export function evaluateVisit(remaining: number, score: number, config: ScoringConfig): VisitOutcome {
  if (!isValidVisitScore(score)) {
    return { kind: 'invalid', reason: 'Enter a possible 3-dart score (0–180)' }
  }
  if (isBust(remaining, score, config.doubleOut)) {
    return { kind: 'bust', remaining }
  }
  const after = remaining - score
  if (after === 0) return { kind: 'leg_win' }
  return { kind: 'score', remaining: after }
}

/**
 * Index of the player who throws first in a leg. Alternates each leg,
 * starting with player 0 in leg 1 (standard darts convention).
 */
export function legStarterIndex(legNumber: number, playerCount: number): number {
  if (playerCount <= 0) return 0
  return (legNumber - 1) % playerCount
}

export interface LegState {
  /** Remaining score per user_id. */
  scores: Record<string, number>
  /** Whose turn it is, as an index into the players array. */
  currentPlayerIndex: number
}

/**
 * Rebuilds the current leg's scores and turn from its ordered event list.
 * Bust events are stored with the unchanged remaining_score, so replaying
 * `remaining_score` per event is sufficient for both cases.
 */
export function rebuildLegState(
  events: ScoringEvent[],
  playerIds: string[],
  legNumber: number,
  config: ScoringConfig,
): LegState {
  const scores: Record<string, number> = {}
  for (const id of playerIds) scores[id] = config.startingScore
  for (const event of events) scores[event.user_id] = event.remaining_score

  const starter = legStarterIndex(legNumber, playerIds.length)
  const currentPlayerIndex = playerIds.length > 0
    ? (starter + events.length) % playerIds.length
    : 0

  return { scores, currentPlayerIndex }
}

// ─── Config resolution ────────────────────────────────────────────────────────

/**
 * Resolves the scoring rules for a match. Tournament matches inherit
 * startingScore / doubleOut from the tournament config; casual and league
 * matches use the defaults (501, double-out). No schema change needed —
 * the link goes through tournament_matches.match_id.
 */
export async function getScoringConfigForMatch(matchId: string): Promise<ScoringConfig> {
  const { data } = await supabase
    .from('tournament_matches')
    .select('tournament:tournament_id(config)')
    .eq('match_id', matchId)
    .maybeSingle()

  // Supabase can type joined rows as object or array depending on inference
  const joined = data?.tournament as { config?: Partial<ScoringConfig> } | { config?: Partial<ScoringConfig> }[] | null | undefined
  const config = Array.isArray(joined) ? joined[0]?.config : joined?.config

  return {
    startingScore: config?.startingScore ?? DEFAULT_SCORING_CONFIG.startingScore,
    doubleOut: config?.doubleOut ?? DEFAULT_SCORING_CONFIG.doubleOut,
  }
}

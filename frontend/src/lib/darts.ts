// ─── Constants ────────────────────────────────────────────────────────────────

/** All values that can be finished with a single double dart. D1=2 … D20=40, Bull=50 */
export const VALID_DOUBLES = new Set([
  2, 4, 6, 8, 10, 12, 14, 16, 18, 20,
  22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
  50,
])

/**
 * Scores that are impossible to checkout even with 3 darts.
 * Max checkout is 170 (T20 T20 Bull). Specific values below 170 that can't be checked out.
 */
const IMPOSSIBLE_CHECKOUTS = new Set([
  0, 1, 169, 168, 166, 165, 163, 162, 159,
])

// ─── Checkout table ───────────────────────────────────────────────────────────

const CHECKOUT_TABLE: Record<number, string> = {
  // Single-dart doubles (D1–D20 + Bull)
  2: 'D1', 4: 'D2', 6: 'D3', 8: 'D4', 10: 'D5',
  12: 'D6', 14: 'D7', 16: 'D8', 18: 'D9', 20: 'D10',
  22: 'D11', 24: 'D12', 26: 'D13', 28: 'D14', 30: 'D15',
  32: 'D16', 34: 'D17', 36: 'D18', 38: 'D19', 40: 'D20',
  50: 'Bull',

  // Two-dart checkouts
  41: 'S9 D16',    42: 'S10 D16',   43: 'S3 D20',   44: 'S4 D20',
  45: 'S13 D16',   46: 'S6 D20',    47: 'S7 D20',   48: 'S8 D20',
  49: 'S9 D20',    51: 'S11 D20',   52: 'S12 D20',  53: 'S13 D20',
  54: 'S14 D20',   55: 'S15 D20',   56: 'S16 D20',  57: 'S17 D20',
  58: 'S18 D20',   59: 'S19 D20',   60: 'S20 D20',
  61: 'T7 D20',    62: 'T10 D16',   63: 'T13 D12',  64: 'T16 D8',
  65: 'T19 D4',    66: 'T10 D18',   67: 'T9 D20',   68: 'T12 D16',
  69: 'T11 D18',   70: 'T10 D20',   71: 'T13 D16',  72: 'T16 D12',
  73: 'T19 D8',    74: 'T14 D16',   75: 'T17 D12',  76: 'T20 D8',
  77: 'T15 D16',   78: 'T18 D12',   79: 'T19 D11',  80: 'T20 D10',
  81: 'T19 D12',   82: 'T14 D20',   83: 'T17 D16',  84: 'T20 D12',
  85: 'T15 D20',   86: 'T18 D16',   87: 'T17 D18',  88: 'T20 D14',
  89: 'T19 D16',   90: 'T20 D15',   91: 'T17 D20',  92: 'T20 D16',
  93: 'T19 D18',   94: 'T18 D20',   95: 'T19 D19',  96: 'T20 D18',
  97: 'T19 D20',   98: 'T20 D19',   99: 'T19 D21',  100: 'T20 D20',

  // Three-dart checkouts
  101: 'T20 S9 D16',   102: 'T20 S10 D16',  103: 'T20 S3 D20',
  104: 'T20 S4 D20',   105: 'T20 S13 D16',  106: 'T20 S6 D20',
  107: 'T19 S10 D20',  108: 'T20 S8 D20',   109: 'T20 S9 D20',
  110: 'T20 S10 D20',  111: 'T20 S11 D20',  112: 'T20 S12 D20',
  113: 'T20 S13 D20',  114: 'T20 S14 D20',  115: 'T20 S15 D20',
  116: 'T20 S16 D20',  117: 'T20 S17 D20',  118: 'T20 S18 D20',
  119: 'T20 S19 D20',  120: 'T20 S20 D20',
  121: 'T20 T19 D2',   122: 'T18 T18 D7',   123: 'T19 T16 D9',
  124: 'T20 T16 D8',   125: 'T20 T15 D10',  126: 'T19 T19 D6',
  127: 'T20 T17 D8',   128: 'T18 T18 D10',  129: 'T19 T16 D12',
  130: 'T20 T18 D8',   131: 'T20 T13 D16',  132: 'T20 T16 D12',
  133: 'T20 T19 D8',   134: 'T20 T14 D16',  135: 'T20 T15 D15',
  136: 'T20 T20 D8',   137: 'T20 T19 D10',  138: 'T20 T18 D12',
  139: 'T19 T14 D20',  140: 'T20 T20 D10',  141: 'T20 T19 D12',
  142: 'T20 T14 D20',  143: 'T20 T17 D16',  144: 'T20 T20 D12',
  145: 'T20 T15 D20',  146: 'T20 T18 D16',  147: 'T20 T17 D18',
  148: 'T20 T16 D20',  149: 'T20 T19 D16',  150: 'T20 T18 D18',
  151: 'T20 T17 D20',  152: 'T20 T20 D16',  153: 'T20 T19 D18',
  154: 'T20 T18 D20',  155: 'T20 T19 D19',  156: 'T20 T20 D18',
  157: 'T20 T19 D20',  158: 'T20 T20 D19',  160: 'T20 T20 D20',
  161: 'T20 T17 Bull', 164: 'T20 T18 Bull', 167: 'T20 T19 Bull',
  170: 'T20 T20 Bull',
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Returns true if `remaining` can be finished within a single 3-dart visit
 * ending on a double (standard double-out checkout feasibility).
 */
export function canCheckout(remaining: number): boolean {
  return remaining >= 2 && remaining <= 170 && !IMPOSSIBLE_CHECKOUTS.has(remaining)
}

/**
 * Returns true if scoring `score` (a whole-visit total) from `remaining` is a bust.
 *
 * Bust conditions (standard 501 rules):
 *  1. Score exceeds remaining (would go negative)
 *  2. Double-out: remaining after the visit is exactly 1 (impossible to
 *     finish from 1 with a double)
 *  3. Double-out: visit lands exactly on 0 but `remaining` was not a
 *     checkout-able score (above 170, or one of the impossible values).
 *     Since only the visit total is entered, any feasible checkout total
 *     is accepted — we cannot verify the final dart was a double.
 */
export function isBust(remaining: number, score: number, doubleOut: boolean): boolean {
  const after = remaining - score
  if (after < 0) return true
  if (doubleOut && after === 1) return true
  if (after === 0 && doubleOut && !canCheckout(remaining)) return true
  return false
}

/**
 * Applies a visit score to the remaining total.
 * Returns the new remaining and whether it was a bust.
 * On a bust the remaining is unchanged.
 */
export function applyScore(
  remaining: number,
  score: number,
  doubleOut: boolean,
): { remaining: number; bust: boolean } {
  if (isBust(remaining, score, doubleOut)) {
    return { remaining, bust: true }
  }
  return { remaining: remaining - score, bust: false }
}

/**
 * Returns the number of legs required to win a match played as best-of-N.
 * E.g., best of 3 → 2, best of 5 → 3.
 */
export function legsToWin(bestOf: number): number {
  return Math.ceil(bestOf / 2)
}

/**
 * Returns true when a player has won enough legs to clinch the match.
 */
export function isMatchComplete(legsWon: number, legsNeeded: number): boolean {
  return legsWon >= legsNeeded
}

/**
 * Returns a standard checkout suggestion string for the given remaining score,
 * or null if no checkout is possible (score is 0, 1, above 170, or in the
 * set of impossible checkout values).
 *
 * Format: space-separated dart values, e.g. 'T20 T20 Bull' or 'D16'.
 */
export function getCheckout(remaining: number): string | null {
  if (remaining <= 1) return null
  if (remaining > 170) return null
  if (IMPOSSIBLE_CHECKOUTS.has(remaining)) return null
  return CHECKOUT_TABLE[remaining] ?? null
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface VisitRecord {
  visitNumber: number
  score: number
  remaining: number
  bust: boolean
}

/** Calculates the 3-dart average from a list of non-bust visits. */
export function threeDartAverage(startingScore: number, visits: VisitRecord[]): number {
  const validVisits = visits.filter(v => !v.bust)
  if (validVisits.length === 0) return 0
  const totalScored = startingScore - (validVisits.at(-1)?.remaining ?? startingScore)
  return totalScored / validVisits.length
}

/** Returns the average of the first three visits (first 9 darts). */
export function firstNineAverage(visits: VisitRecord[]): number {
  const first3 = visits.filter(v => !v.bust).slice(0, 3)
  if (first3.length === 0) return 0
  const total = first3.reduce((sum, v) => sum + v.score, 0)
  return total / first3.length
}

/** Counts how many visits scored exactly 180. */
export function count180s(visits: VisitRecord[]): number {
  return visits.filter(v => !v.bust && v.score === 180).length
}

/** Counts how many visits were busts. */
export function countBusts(visits: VisitRecord[]): number {
  return visits.filter(v => v.bust).length
}

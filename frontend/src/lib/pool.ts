// ─── Pool frame scoring ───────────────────────────────────────────────────────

export type FrameOutcome = 'win' | 'loss' | 'foul'

export interface FrameRecord {
  frameNumber: number
  outcome: FrameOutcome
  foul: boolean
}

/**
 * Returns the number of frames required to win a match played best-of-N.
 * E.g., best of 3 → 2, best of 5 → 3.
 */
export function legsToWin(bestOf: number): number {
  return Math.ceil(bestOf / 2)
}

/**
 * Returns true when a player has won enough frames to clinch the match.
 */
export function isMatchComplete(framesWon: number, framesNeeded: number): boolean {
  return framesWon >= framesNeeded
}

/**
 * Creates a frame record for a given frame number and outcome.
 */
export function createFrame(frameNumber: number, outcome: FrameOutcome): FrameRecord {
  return { frameNumber, outcome, foul: outcome === 'foul' }
}

/**
 * Counts the number of frames won from a list of frame records.
 * A 'foul' counts as a loss for the player who fouled.
 */
export function countFramesWon(frames: FrameRecord[]): number {
  return frames.filter(f => f.outcome === 'win').length
}

/**
 * Counts the number of fouls recorded.
 */
export function countFouls(frames: FrameRecord[]): number {
  return frames.filter(f => f.foul).length
}

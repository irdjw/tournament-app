import {
  DEFAULT_SCORING_CONFIG,
  evaluateVisit,
  isValidVisitScore,
  legStarterIndex,
  rebuildLegState,
  type ScoringConfig,
} from '../../src/lib/scoring'

const DOUBLE_OUT: ScoringConfig = { startingScore: 501, doubleOut: true }
const STRAIGHT_OUT: ScoringConfig = { startingScore: 501, doubleOut: false }
const THREE_O_ONE: ScoringConfig = { startingScore: 301, doubleOut: true }

// ─── isValidVisitScore ───────────────────────────────────────────────────────

describe('isValidVisitScore', () => {
  it('accepts 0 through 180 generally', () => {
    expect(isValidVisitScore(0)).toBe(true)
    expect(isValidVisitScore(26)).toBe(true)
    expect(isValidVisitScore(100)).toBe(true)
    expect(isValidVisitScore(180)).toBe(true)
  })

  it('rejects negatives, > 180, and non-integers', () => {
    expect(isValidVisitScore(-1)).toBe(false)
    expect(isValidVisitScore(181)).toBe(false)
    expect(isValidVisitScore(60.5)).toBe(false)
    expect(isValidVisitScore(NaN)).toBe(false)
  })

  it('rejects totals impossible with three darts', () => {
    for (const n of [163, 166, 169, 172, 173, 175, 176, 178, 179]) {
      expect(isValidVisitScore(n)).toBe(false)
    }
  })

  it('accepts near-maximum totals that ARE possible', () => {
    for (const n of [162, 165, 168, 171, 174, 177]) {
      expect(isValidVisitScore(n)).toBe(true)
    }
  })
})

// ─── evaluateVisit ───────────────────────────────────────────────────────────

describe('evaluateVisit', () => {
  it('returns invalid for impossible input', () => {
    expect(evaluateVisit(501, 181, DOUBLE_OUT).kind).toBe('invalid')
    expect(evaluateVisit(501, 179, DOUBLE_OUT).kind).toBe('invalid')
    expect(evaluateVisit(501, -5, DOUBLE_OUT).kind).toBe('invalid')
  })

  it('returns score with the new remaining on a normal visit', () => {
    expect(evaluateVisit(501, 140, DOUBLE_OUT)).toEqual({ kind: 'score', remaining: 361 })
  })

  it('returns bust when going below zero', () => {
    expect(evaluateVisit(40, 60, DOUBLE_OUT)).toEqual({ kind: 'bust', remaining: 40 })
  })

  describe('double-out', () => {
    it('busts when leaving exactly 1', () => {
      expect(evaluateVisit(41, 40, DOUBLE_OUT)).toEqual({ kind: 'bust', remaining: 41 })
    })

    it('wins the leg on a feasible checkout total', () => {
      expect(evaluateVisit(40, 40, DOUBLE_OUT)).toEqual({ kind: 'leg_win' })
      expect(evaluateVisit(100, 100, DOUBLE_OUT)).toEqual({ kind: 'leg_win' })
      expect(evaluateVisit(170, 170, DOUBLE_OUT)).toEqual({ kind: 'leg_win' })
    })

    it('busts on a checkout total that is impossible ending on a double', () => {
      // 168 is a throwable total (T20 T20 T16) but not a checkout
      expect(evaluateVisit(168, 168, DOUBLE_OUT)).toEqual({ kind: 'bust', remaining: 168 })
    })
  })

  describe('straight-out (doubleOut = false)', () => {
    it('does NOT bust when leaving exactly 1', () => {
      expect(evaluateVisit(41, 40, STRAIGHT_OUT)).toEqual({ kind: 'score', remaining: 1 })
    })

    it('wins the leg on any exact finish', () => {
      expect(evaluateVisit(33, 33, STRAIGHT_OUT)).toEqual({ kind: 'leg_win' })
      expect(evaluateVisit(1, 1, STRAIGHT_OUT)).toEqual({ kind: 'leg_win' })
    })
  })
})

// ─── legStarterIndex ─────────────────────────────────────────────────────────

describe('legStarterIndex', () => {
  it('alternates the thrower each leg for two players', () => {
    expect(legStarterIndex(1, 2)).toBe(0)
    expect(legStarterIndex(2, 2)).toBe(1)
    expect(legStarterIndex(3, 2)).toBe(0)
    expect(legStarterIndex(4, 2)).toBe(1)
  })

  it('handles a degenerate player count', () => {
    expect(legStarterIndex(1, 0)).toBe(0)
  })
})

// ─── rebuildLegState ─────────────────────────────────────────────────────────

describe('rebuildLegState', () => {
  const players = ['alice', 'bob']

  it('initialises everyone to the configured starting score with no events', () => {
    const state = rebuildLegState([], players, 1, THREE_O_ONE)
    expect(state.scores).toEqual({ alice: 301, bob: 301 })
    expect(state.currentPlayerIndex).toBe(0)
  })

  it('replays events and computes whose turn it is', () => {
    const events = [
      { user_id: 'alice', remaining_score: 441 },
      { user_id: 'bob', remaining_score: 401 },
      { user_id: 'alice', remaining_score: 381 },
    ]
    const state = rebuildLegState(events, players, 1, DEFAULT_SCORING_CONFIG)
    expect(state.scores).toEqual({ alice: 381, bob: 401 })
    expect(state.currentPlayerIndex).toBe(1) // bob to throw
  })

  it('offsets the turn by the leg starter in even legs', () => {
    const state = rebuildLegState([], players, 2, DEFAULT_SCORING_CONFIG)
    expect(state.currentPlayerIndex).toBe(1) // bob starts leg 2
  })

  it('keeps remaining unchanged after a bust event (stored as-is)', () => {
    const events = [
      { user_id: 'alice', remaining_score: 441 },
      { user_id: 'bob', remaining_score: 501 }, // bust — remaining unchanged
    ]
    const state = rebuildLegState(events, players, 1, DEFAULT_SCORING_CONFIG)
    expect(state.scores.bob).toBe(501)
    expect(state.currentPlayerIndex).toBe(0)
  })
})

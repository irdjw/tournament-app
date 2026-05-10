import {
  VALID_DOUBLES,
  isBust,
  applyScore,
  legsToWin,
  isMatchComplete,
  getCheckout,
  threeDartAverage,
  firstNineAverage,
  count180s,
  countBusts,
} from '../../src/lib/darts'
import { makeVisit, makeVisitSequence } from '../factories'

// ─── VALID_DOUBLES ────────────────────────────────────────────────────────────

describe('VALID_DOUBLES', () => {
  it('contains all even numbers from 2 to 40', () => {
    for (let i = 1; i <= 20; i++) {
      expect(VALID_DOUBLES.has(i * 2)).toBe(true)
    }
  })

  it('contains 50 (Bull)', () => {
    expect(VALID_DOUBLES.has(50)).toBe(true)
  })

  it('does not contain odd numbers', () => {
    expect(VALID_DOUBLES.has(1)).toBe(false)
    expect(VALID_DOUBLES.has(3)).toBe(false)
    expect(VALID_DOUBLES.has(33)).toBe(false)
  })

  it('does not contain values > 50', () => {
    expect(VALID_DOUBLES.has(52)).toBe(false)
    expect(VALID_DOUBLES.has(60)).toBe(false)
  })
})

// ─── isBust ───────────────────────────────────────────────────────────────────

describe('isBust', () => {
  describe('double-out = true', () => {
    it('is a bust when score exceeds remaining', () => {
      expect(isBust(32, 33, true)).toBe(true)
      expect(isBust(10, 11, true)).toBe(true)
    })

    it('is a bust when remaining - score = 0 but score is not a valid double', () => {
      expect(isBust(33, 33, true)).toBe(true)  // 33 is not a valid double
      expect(isBust(60, 60, true)).toBe(true)  // 60 is not a valid double
    })

    it('is NOT a bust when score is a valid double and lands on 0', () => {
      expect(isBust(32, 32, true)).toBe(false)  // D16 = 32, valid
      expect(isBust(40, 40, true)).toBe(false)  // D20 = 40, valid
      expect(isBust(50, 50, true)).toBe(false)  // Bull = 50, valid
      expect(isBust(2, 2, true)).toBe(false)    // D1 = 2, valid
    })

    it('is NOT a bust when remaining > 0 after score', () => {
      expect(isBust(100, 60, true)).toBe(false)
      expect(isBust(501, 180, true)).toBe(false)
    })

    it('is NOT a bust when result is 1 (handled next visit)', () => {
      expect(isBust(3, 2, true)).toBe(false)  // leaves 1 — not a bust this visit
    })
  })

  describe('double-out = false', () => {
    it('is a bust only when score exceeds remaining', () => {
      expect(isBust(32, 33, false)).toBe(true)
    })

    it('is NOT a bust when score equals remaining (any value)', () => {
      expect(isBust(33, 33, false)).toBe(false)
      expect(isBust(1, 1, false)).toBe(false)
      expect(isBust(60, 60, false)).toBe(false)
    })
  })
})

// ─── applyScore ───────────────────────────────────────────────────────────────

describe('applyScore', () => {
  it('deducts score and returns bust=false on a valid visit', () => {
    expect(applyScore(100, 60, true)).toEqual({ remaining: 40, bust: false })
    expect(applyScore(501, 180, true)).toEqual({ remaining: 321, bust: false })
  })

  it('leaves remaining unchanged and returns bust=true on a bust', () => {
    expect(applyScore(32, 33, true)).toEqual({ remaining: 32, bust: true })
    expect(applyScore(33, 33, true)).toEqual({ remaining: 33, bust: true })
  })

  it('handles a checkout (remaining → 0) correctly', () => {
    expect(applyScore(32, 32, true)).toEqual({ remaining: 0, bust: false })
    expect(applyScore(50, 50, true)).toEqual({ remaining: 0, bust: false })
  })
})

// ─── legsToWin ────────────────────────────────────────────────────────────────

describe('legsToWin', () => {
  it.each([
    [1, 1],
    [3, 2],
    [5, 3],
    [7, 4],
    [9, 5],
  ])('best of %i → %i legs to win', (bestOf, expected) => {
    expect(legsToWin(bestOf)).toBe(expected)
  })
})

// ─── isMatchComplete ─────────────────────────────────────────────────────────

describe('isMatchComplete', () => {
  it('returns true when legs won >= legs needed', () => {
    expect(isMatchComplete(2, 2)).toBe(true)
    expect(isMatchComplete(3, 2)).toBe(true)
  })

  it('returns false when legs won < legs needed', () => {
    expect(isMatchComplete(1, 2)).toBe(false)
    expect(isMatchComplete(0, 3)).toBe(false)
  })
})

// ─── getCheckout ─────────────────────────────────────────────────────────────

describe('getCheckout', () => {
  it('returns null for 0 and 1', () => {
    expect(getCheckout(0)).toBeNull()
    expect(getCheckout(1)).toBeNull()
  })

  it('returns null for values above 170', () => {
    expect(getCheckout(171)).toBeNull()
    expect(getCheckout(180)).toBeNull()
    expect(getCheckout(501)).toBeNull()
  })

  it('returns null for impossible checkouts', () => {
    expect(getCheckout(169)).toBeNull()
    expect(getCheckout(168)).toBeNull()
    expect(getCheckout(166)).toBeNull()
    expect(getCheckout(163)).toBeNull()
    expect(getCheckout(159)).toBeNull()
  })

  it('returns single-dart doubles for values 2–40 (even)', () => {
    expect(getCheckout(2)).toBe('D1')
    expect(getCheckout(16)).toBe('D8')
    expect(getCheckout(32)).toBe('D16')
    expect(getCheckout(40)).toBe('D20')
  })

  it('returns Bull for 50', () => {
    expect(getCheckout(50)).toBe('Bull')
  })

  it('returns two-dart checkouts', () => {
    expect(getCheckout(100)).toBe('T20 D20')
    expect(getCheckout(60)).toBe('S20 D20')
    expect(getCheckout(41)).toBe('S9 D16')
  })

  it('returns three-dart checkouts', () => {
    expect(getCheckout(170)).toBe('T20 T20 Bull')
    expect(getCheckout(121)).toBe('T20 T19 D2')
    expect(getCheckout(101)).toBe('T20 S9 D16')
  })
})

// ─── threeDartAverage ────────────────────────────────────────────────────────

describe('threeDartAverage', () => {
  it('returns 0 for an empty visit list', () => {
    expect(threeDartAverage(501, [])).toBe(0)
  })

  it('calculates correctly from a finished leg', () => {
    // 501 → scores 60 three times, remaining = 321
    const visits = [
      makeVisit({ visitNumber: 1, score: 60, remaining: 441, bust: false }),
      makeVisit({ visitNumber: 2, score: 60, remaining: 381, bust: false }),
      makeVisit({ visitNumber: 3, score: 60, remaining: 321, bust: false }),
    ]
    // totalScored = 501 - 321 = 180, numVisits = 3, avg = 180/3 = 60
    expect(threeDartAverage(501, visits)).toBeCloseTo(60)
  })

  it('excludes bust visits from the average', () => {
    const visits = [
      makeVisit({ visitNumber: 1, score: 60, remaining: 441, bust: false }),
      makeVisit({ visitNumber: 2, score: 99, remaining: 441, bust: true }),
      makeVisit({ visitNumber: 3, score: 60, remaining: 381, bust: false }),
    ]
    // After busts stripped: 2 valid visits, last remaining = 381
    // totalScored = 501 - 381 = 120, avg = 120/2 = 60
    expect(threeDartAverage(501, visits)).toBeCloseTo(60)
  })

  it('returns 0 when all visits are busts', () => {
    const visits = [
      makeVisit({ visitNumber: 1, score: 999, remaining: 501, bust: true }),
    ]
    expect(threeDartAverage(501, visits)).toBe(0)
  })
})

// ─── firstNineAverage ────────────────────────────────────────────────────────

describe('firstNineAverage', () => {
  it('returns 0 for an empty visit list', () => {
    expect(firstNineAverage([])).toBe(0)
  })

  it('averages only the first three non-bust visits', () => {
    const visits = makeVisitSequence(501, [60, 60, 60, 60])
    // First 3 scores are 60 each → total = 180, avg = 180/3 = 60
    expect(firstNineAverage(visits)).toBeCloseTo(60)
  })

  it('ignores more than 3 visits', () => {
    const visits = makeVisitSequence(501, [100, 100, 100, 180, 180])
    // Only first 3: total = 300, avg = 300/3 = 100
    expect(firstNineAverage(visits)).toBeCloseTo(100)
  })

  it('skips bust visits when picking first three', () => {
    const visits = [
      makeVisit({ visitNumber: 1, score: 60,  remaining: 441, bust: false }),
      makeVisit({ visitNumber: 2, score: 999, remaining: 441, bust: true }),
      makeVisit({ visitNumber: 3, score: 60,  remaining: 381, bust: false }),
      makeVisit({ visitNumber: 4, score: 60,  remaining: 321, bust: false }),
      makeVisit({ visitNumber: 5, score: 60,  remaining: 261, bust: false }),
    ]
    // First 3 valid (visits 1, 3, 4): all 60 → total = 180, avg = 60
    expect(firstNineAverage(visits)).toBeCloseTo(60)
  })
})

// ─── count180s ───────────────────────────────────────────────────────────────

describe('count180s', () => {
  it('returns 0 when no 180s', () => {
    const visits = [makeVisit({ score: 60, bust: false }), makeVisit({ score: 180, bust: true })]
    expect(count180s(visits)).toBe(0)
  })

  it('counts valid 180s only', () => {
    const visits = [
      makeVisit({ score: 180, bust: false }),
      makeVisit({ score: 180, bust: false }),
      makeVisit({ score: 180, bust: true }),
      makeVisit({ score: 60,  bust: false }),
    ]
    expect(count180s(visits)).toBe(2)
  })
})

// ─── countBusts ──────────────────────────────────────────────────────────────

describe('countBusts', () => {
  it('returns 0 with no busts', () => {
    const visits = [makeVisit({ bust: false }), makeVisit({ bust: false })]
    expect(countBusts(visits)).toBe(0)
  })

  it('counts all bust visits', () => {
    const visits = [
      makeVisit({ bust: false }),
      makeVisit({ bust: true }),
      makeVisit({ bust: true }),
    ]
    expect(countBusts(visits)).toBe(2)
  })
})

// ─── makeVisitSequence (factory integration) ─────────────────────────────────

describe('makeVisitSequence', () => {
  it('builds a correct sequence tracking remaining', () => {
    const visits = makeVisitSequence(501, [60, 60, 60])
    expect(visits).toHaveLength(3)
    expect(visits[0]).toMatchObject({ visitNumber: 1, score: 60, remaining: 441, bust: false })
    expect(visits[1]).toMatchObject({ visitNumber: 2, score: 60, remaining: 381, bust: false })
    expect(visits[2]).toMatchObject({ visitNumber: 3, score: 60, remaining: 321, bust: false })
  })

  it('marks busts correctly and does not advance remaining', () => {
    const visits = makeVisitSequence(32, [33, 32], true)
    expect(visits[0]).toMatchObject({ score: 33, remaining: 32, bust: true })
    expect(visits[1]).toMatchObject({ score: 32, remaining: 0,  bust: false })
  })
})

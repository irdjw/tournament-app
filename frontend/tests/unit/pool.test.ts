import {
  legsToWin,
  isMatchComplete,
  createFrame,
  countFramesWon,
  countFouls,
} from '../../src/lib/pool'
import type { FrameRecord } from '../../src/lib/pool'

// ─── legsToWin ────────────────────────────────────────────────────────────────

describe('legsToWin', () => {
  it.each([
    [1, 1],
    [3, 2],
    [5, 3],
    [7, 4],
    [9, 5],
  ])('best of %i → %i frames to win', (bestOf, expected) => {
    expect(legsToWin(bestOf)).toBe(expected)
  })
})

// ─── isMatchComplete ─────────────────────────────────────────────────────────

describe('isMatchComplete', () => {
  it('returns true when frames won equals frames needed', () => {
    expect(isMatchComplete(2, 2)).toBe(true)
  })

  it('returns true when frames won exceeds frames needed', () => {
    expect(isMatchComplete(3, 2)).toBe(true)
  })

  it('returns false when frames won is below threshold', () => {
    expect(isMatchComplete(1, 2)).toBe(false)
    expect(isMatchComplete(0, 3)).toBe(false)
  })
})

// ─── createFrame ─────────────────────────────────────────────────────────────

describe('createFrame', () => {
  it('creates a win frame with foul=false', () => {
    const frame = createFrame(1, 'win')
    expect(frame).toEqual({ frameNumber: 1, outcome: 'win', foul: false })
  })

  it('creates a loss frame with foul=false', () => {
    const frame = createFrame(2, 'loss')
    expect(frame).toEqual({ frameNumber: 2, outcome: 'loss', foul: false })
  })

  it('creates a foul frame with foul=true', () => {
    const frame = createFrame(3, 'foul')
    expect(frame).toEqual({ frameNumber: 3, outcome: 'foul', foul: true })
  })
})

// ─── countFramesWon ──────────────────────────────────────────────────────────

describe('countFramesWon', () => {
  it('returns 0 for an empty list', () => {
    expect(countFramesWon([])).toBe(0)
  })

  it('counts only frames with outcome="win"', () => {
    const frames: FrameRecord[] = [
      createFrame(1, 'win'),
      createFrame(2, 'loss'),
      createFrame(3, 'win'),
      createFrame(4, 'foul'),
    ]
    expect(countFramesWon(frames)).toBe(2)
  })

  it('does not count fouls as wins', () => {
    const frames: FrameRecord[] = [
      createFrame(1, 'foul'),
      createFrame(2, 'foul'),
    ]
    expect(countFramesWon(frames)).toBe(0)
  })
})

// ─── countFouls ──────────────────────────────────────────────────────────────

describe('countFouls', () => {
  it('returns 0 for an empty list', () => {
    expect(countFouls([])).toBe(0)
  })

  it('counts only frames with foul=true', () => {
    const frames: FrameRecord[] = [
      createFrame(1, 'win'),
      createFrame(2, 'foul'),
      createFrame(3, 'loss'),
      createFrame(4, 'foul'),
    ]
    expect(countFouls(frames)).toBe(2)
  })

  it('returns 0 when no fouls', () => {
    const frames: FrameRecord[] = [
      createFrame(1, 'win'),
      createFrame(2, 'loss'),
    ]
    expect(countFouls(frames)).toBe(0)
  })
})

// ─── match simulation ────────────────────────────────────────────────────────

describe('match simulation (best-of-5)', () => {
  it('ends when a player reaches 3 frames', () => {
    const needed = legsToWin(5)  // 3
    const frames: FrameRecord[] = []
    let won = 0

    for (let i = 1; i <= 5; i++) {
      if (isMatchComplete(won, needed)) break
      const frame = createFrame(i, i % 2 === 0 ? 'loss' : 'win')
      frames.push(frame)
      won = countFramesWon(frames)
    }

    // Wins on frames 1, 3, 5 → 3 wins → complete after frame 5
    expect(isMatchComplete(won, needed)).toBe(true)
    expect(frames.length).toBe(5)
  })

  it('can complete in minimum frames (3-0)', () => {
    const needed = legsToWin(5)
    const frames: FrameRecord[] = [
      createFrame(1, 'win'),
      createFrame(2, 'win'),
      createFrame(3, 'win'),
    ]
    expect(isMatchComplete(countFramesWon(frames), needed)).toBe(true)
  })
})

import {
  calculatePoints,
  legDifference,
  emptyStanding,
  applyResult,
  sortStandings,
} from '../../src/lib/standings'
import { makeStanding } from '../factories'

// ─── calculatePoints ─────────────────────────────────────────────────────────

describe('calculatePoints', () => {
  it.each([
    [0, 0, 0],
    [1, 0, 2],
    [0, 1, 1],
    [3, 2, 8],
    [2, 1, 5],
  ])('won=%i drawn=%i → %i pts', (won, drawn, expected) => {
    expect(calculatePoints(won, drawn)).toBe(expected)
  })
})

// ─── legDifference ───────────────────────────────────────────────────────────

describe('legDifference', () => {
  it('returns legsFor - legsAgainst', () => {
    expect(legDifference({ legsFor: 10, legsAgainst: 6 })).toBe(4)
    expect(legDifference({ legsFor: 3,  legsAgainst: 7 })).toBe(-4)
    expect(legDifference({ legsFor: 5,  legsAgainst: 5 })).toBe(0)
  })
})

// ─── emptyStanding ───────────────────────────────────────────────────────────

describe('emptyStanding', () => {
  it('returns a zeroed standing with the given userId and name', () => {
    const row = emptyStanding('u1', 'Alice')
    expect(row).toEqual({
      userId: 'u1',
      name: 'Alice',
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      legsFor: 0,
      legsAgainst: 0,
      points: 0,
    })
  })
})

// ─── applyResult ─────────────────────────────────────────────────────────────

describe('applyResult', () => {
  it('records a win correctly', () => {
    const before = emptyStanding('u1', 'Alice')
    const after  = applyResult(before, 'win', 3, 1)
    expect(after.played).toBe(1)
    expect(after.won).toBe(1)
    expect(after.drawn).toBe(0)
    expect(after.lost).toBe(0)
    expect(after.legsFor).toBe(3)
    expect(after.legsAgainst).toBe(1)
    expect(after.points).toBe(2)
  })

  it('records a draw correctly', () => {
    const before = emptyStanding('u1', 'Alice')
    const after  = applyResult(before, 'draw', 2, 2)
    expect(after.drawn).toBe(1)
    expect(after.points).toBe(1)
    expect(after.played).toBe(1)
  })

  it('records a loss correctly', () => {
    const before = emptyStanding('u1', 'Alice')
    const after  = applyResult(before, 'loss', 1, 3)
    expect(after.lost).toBe(1)
    expect(after.points).toBe(0)
    expect(after.played).toBe(1)
    expect(after.legsFor).toBe(1)
    expect(after.legsAgainst).toBe(3)
  })

  it('accumulates across multiple results', () => {
    let row = emptyStanding('u1', 'Alice')
    row = applyResult(row, 'win',  3, 1)
    row = applyResult(row, 'win',  3, 0)
    row = applyResult(row, 'draw', 2, 2)
    row = applyResult(row, 'loss', 1, 3)
    expect(row.played).toBe(4)
    expect(row.won).toBe(2)
    expect(row.drawn).toBe(1)
    expect(row.lost).toBe(1)
    expect(row.legsFor).toBe(9)
    expect(row.legsAgainst).toBe(6)
    expect(row.points).toBe(5)
  })

  it('does not mutate the input row', () => {
    const before = emptyStanding('u1', 'Alice')
    applyResult(before, 'win', 3, 1)
    expect(before.played).toBe(0)
    expect(before.points).toBe(0)
  })
})

// ─── sortStandings ───────────────────────────────────────────────────────────

describe('sortStandings', () => {
  it('sorts by points descending', () => {
    const rows = [
      makeStanding({ name: 'C', won: 0, drawn: 0, lost: 3, points: 0 }),
      makeStanding({ name: 'A', won: 3, drawn: 0, lost: 0, points: 6 }),
      makeStanding({ name: 'B', won: 1, drawn: 1, lost: 1, points: 3 }),
    ]
    const sorted = sortStandings(rows)
    expect(sorted.map(r => r.name)).toEqual(['A', 'B', 'C'])
  })

  it('breaks ties by leg difference descending', () => {
    const rows = [
      makeStanding({ name: 'B', won: 2, points: 4, legsFor: 6, legsAgainst: 5 }),
      makeStanding({ name: 'A', won: 2, points: 4, legsFor: 9, legsAgainst: 3 }),
    ]
    const sorted = sortStandings(rows)
    expect(sorted[0].name).toBe('A')  // +6 > +1
  })

  it('breaks further ties by legs for descending', () => {
    const rows = [
      makeStanding({ name: 'B', won: 2, points: 4, legsFor: 7, legsAgainst: 4 }),  // diff +3
      makeStanding({ name: 'A', won: 2, points: 4, legsFor: 9, legsAgainst: 6 }),  // diff +3
    ]
    const sorted = sortStandings(rows)
    expect(sorted[0].name).toBe('A')  // 9 > 7
  })

  it('breaks further ties alphabetically ascending', () => {
    const rows = [
      makeStanding({ name: 'Charlie', won: 2, points: 4, legsFor: 6, legsAgainst: 3 }),
      makeStanding({ name: 'Alice',   won: 2, points: 4, legsFor: 6, legsAgainst: 3 }),
      makeStanding({ name: 'Bob',     won: 2, points: 4, legsFor: 6, legsAgainst: 3 }),
    ]
    const sorted = sortStandings(rows)
    expect(sorted.map(r => r.name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('does not mutate the input array', () => {
    const rows = [
      makeStanding({ name: 'B', won: 0, points: 0 }),
      makeStanding({ name: 'A', won: 3, points: 6 }),
    ]
    const original = [...rows]
    sortStandings(rows)
    expect(rows[0].name).toBe(original[0].name)
  })

  it('handles an empty array', () => {
    expect(sortStandings([])).toEqual([])
  })

  it('handles a single row', () => {
    const rows = [makeStanding({ name: 'Solo', won: 1 })]
    expect(sortStandings(rows)).toHaveLength(1)
  })

  it('preserves all rows in the output', () => {
    const rows = [
      makeStanding({ name: 'A', won: 2 }),
      makeStanding({ name: 'B', won: 1 }),
      makeStanding({ name: 'C', won: 0 }),
    ]
    expect(sortStandings(rows)).toHaveLength(3)
  })
})

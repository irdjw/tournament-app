// ─── Types ────────────────────────────────────────────────────────────────────

export interface StandingRow {
  userId: string
  name: string
  played: number
  won: number
  drawn: number
  lost: number
  legsFor: number
  legsAgainst: number
  points: number
}

// ─── Pure functions ───────────────────────────────────────────────────────────

/** Win = 2 pts, Draw = 1 pt each, Loss = 0 pts. */
export function calculatePoints(won: number, drawn: number): number {
  return won * 2 + drawn
}

/** Leg difference: positive means more legs scored than conceded. */
export function legDifference(row: Pick<StandingRow, 'legsFor' | 'legsAgainst'>): number {
  return row.legsFor - row.legsAgainst
}

/**
 * Creates a blank standing row for a player.
 */
export function emptyStanding(userId: string, name: string): StandingRow {
  return { userId, name, played: 0, won: 0, drawn: 0, lost: 0, legsFor: 0, legsAgainst: 0, points: 0 }
}

/**
 * Returns a new standing row updated with the result of one match.
 * Does not mutate the input.
 */
export function applyResult(
  row: StandingRow,
  outcome: 'win' | 'draw' | 'loss',
  legsFor: number,
  legsAgainst: number,
): StandingRow {
  const won   = row.won   + (outcome === 'win'  ? 1 : 0)
  const drawn = row.drawn + (outcome === 'draw' ? 1 : 0)
  const lost  = row.lost  + (outcome === 'loss' ? 1 : 0)
  return {
    ...row,
    played:       row.played + 1,
    won,
    drawn,
    lost,
    legsFor:      row.legsFor + legsFor,
    legsAgainst:  row.legsAgainst + legsAgainst,
    points:       calculatePoints(won, drawn),
  }
}

/**
 * Sorts standings rows by the standard football-style tiebreakers:
 *  1. Points (desc)
 *  2. Leg difference (desc)
 *  3. Legs for (desc)
 *  4. Name (asc, alphabetical)
 *
 * Returns a new sorted array; does not mutate the input.
 */
export function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const diffA = legDifference(a)
    const diffB = legDifference(b)
    if (diffB !== diffA) return diffB - diffA
    if (b.legsFor !== a.legsFor) return b.legsFor - a.legsFor
    return a.name.localeCompare(b.name)
  })
}

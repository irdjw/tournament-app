import { previewGroups } from '../../src/lib/tournaments'
import { makePlayers } from '../factories'

// ─── non-group formats ───────────────────────────────────────────────────────

describe('previewGroups — non-group formats', () => {
  it('returns a single "Bracket" group for single_elimination', () => {
    const players = makePlayers(8)
    const result = previewGroups(players, 'single_elimination', 4)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Bracket')
    expect(result[0].players).toHaveLength(8)
  })

  it('returns a single "Winners Bracket" group for double_elimination', () => {
    const players = makePlayers(8)
    const result = previewGroups(players, 'double_elimination', 4)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Winners Bracket')
  })
})

// ─── group count ─────────────────────────────────────────────────────────────

describe('previewGroups — group count and naming', () => {
  it('creates the right number of groups for 8 players, size 4', () => {
    const result = previewGroups(makePlayers(8), 'group_stage', 4)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Group A')
    expect(result[1].name).toBe('Group B')
  })

  it('creates 3 groups for 12 players, size 4', () => {
    const result = previewGroups(makePlayers(12), 'group_stage', 4)
    expect(result).toHaveLength(3)
    expect(result[2].name).toBe('Group C')
  })

  it('creates 4 groups for 16 players, size 4', () => {
    const result = previewGroups(makePlayers(16), 'group_stage', 4)
    expect(result).toHaveLength(4)
  })

  it('includes all players across groups', () => {
    const players = makePlayers(10)
    const result = previewGroups(players, 'group_stage', 4)
    const allAssigned = result.flatMap(g => g.players)
    expect(allAssigned).toHaveLength(10)
  })
})

// ─── snake seeding: 8 players / 2 groups ─────────────────────────────────────

describe('previewGroups — snake seeding (8 players, 2 groups)', () => {
  it('puts seeds 1,4,5,8 in Group A and 2,3,6,7 in Group B', () => {
    const players = makePlayers(8, 'Seed')
    const result = previewGroups(players, 'group_stage', 4)

    const groupA = result[0].players.map(p => p.name)
    const groupB = result[1].players.map(p => p.name)

    // Seed 1=index 0, 4=index 3, 5=index 4, 8=index 7
    expect(groupA).toContain('Seed 1')
    expect(groupA).toContain('Seed 4')
    expect(groupA).toContain('Seed 5')
    expect(groupA).toContain('Seed 8')

    // Seed 2=index 1, 3=index 2, 6=index 5, 7=index 6
    expect(groupB).toContain('Seed 2')
    expect(groupB).toContain('Seed 3')
    expect(groupB).toContain('Seed 6')
    expect(groupB).toContain('Seed 7')
  })

  it('gives each group exactly 4 players', () => {
    const result = previewGroups(makePlayers(8), 'group_stage', 4)
    expect(result[0].players).toHaveLength(4)
    expect(result[1].players).toHaveLength(4)
  })
})

// ─── snake seeding: 12 players / 3 groups ────────────────────────────────────

describe('previewGroups — snake seeding (12 players, 3 groups)', () => {
  it('distributes strength evenly: top-3 seeds go to A, B, C respectively', () => {
    const players = makePlayers(12, 'Seed')
    const result = previewGroups(players, 'group_stage', 4)

    // Round 0 (forward): seed 1→A, 2→B, 3→C
    expect(result[0].players.map(p => p.name)).toContain('Seed 1')
    expect(result[1].players.map(p => p.name)).toContain('Seed 2')
    expect(result[2].players.map(p => p.name)).toContain('Seed 3')
  })

  it('reverses in round 1: seeds 4,5,6 go C, B, A', () => {
    const players = makePlayers(12, 'Seed')
    const result = previewGroups(players, 'group_stage', 4)

    expect(result[2].players.map(p => p.name)).toContain('Seed 4')
    expect(result[1].players.map(p => p.name)).toContain('Seed 5')
    expect(result[0].players.map(p => p.name)).toContain('Seed 6')
  })

  it('gives each group exactly 4 players', () => {
    const result = previewGroups(makePlayers(12), 'group_stage', 4)
    result.forEach(g => expect(g.players).toHaveLength(4))
  })
})

// ─── snake seeding: 6 players / 3 groups of 2 ────────────────────────────────

describe('previewGroups — snake seeding (6 players, 3 groups)', () => {
  it('puts seeds 1,6 in Group A; 2,5 in Group B; 3,4 in Group C', () => {
    const players = makePlayers(6, 'Seed')
    const result = previewGroups(players, 'group_stage', 2)

    expect(result[0].players.map(p => p.name)).toEqual(
      expect.arrayContaining(['Seed 1', 'Seed 6'])
    )
    expect(result[1].players.map(p => p.name)).toEqual(
      expect.arrayContaining(['Seed 2', 'Seed 5'])
    )
    expect(result[2].players.map(p => p.name)).toEqual(
      expect.arrayContaining(['Seed 3', 'Seed 4'])
    )
  })
})

// ─── uneven player counts ─────────────────────────────────────────────────────

describe('previewGroups — uneven player counts', () => {
  it('handles 5 players in groups of 4 (one group of 4, one group of 1)', () => {
    const result = previewGroups(makePlayers(5), 'group_stage', 4)
    const total = result.reduce((sum, g) => sum + g.players.length, 0)
    expect(total).toBe(5)
  })

  it('handles 7 players in groups of 4 (two groups: one of 4, one of 3)', () => {
    const result = previewGroups(makePlayers(7), 'group_stage', 4)
    const total = result.reduce((sum, g) => sum + g.players.length, 0)
    expect(total).toBe(7)
  })

  it('filters out empty groups when player count is exact', () => {
    const result = previewGroups(makePlayers(8), 'group_stage', 4)
    result.forEach(g => expect(g.players.length).toBeGreaterThan(0))
  })
})

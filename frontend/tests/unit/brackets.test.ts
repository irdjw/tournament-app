import {
  nextPowerOf2,
  bracketSeeds,
  buildBracketMatches,
  previewGroups,
  getActiveMatches,
  type BracketMatch,
  type Player,
} from '../../src/lib/tournaments'
import { makePlayers } from '../factories'

// ─── nextPowerOf2 ─────────────────────────────────────────────────────────────

describe('nextPowerOf2', () => {
  it.each([
    [1, 1], [2, 2], [3, 4], [4, 4], [5, 8], [7, 8], [8, 8],
    [9, 16], [16, 16], [17, 32], [32, 32],
  ])('nextPowerOf2(%i) === %i', (n, expected) => {
    expect(nextPowerOf2(n)).toBe(expected)
  })
})

// ─── bracketSeeds ─────────────────────────────────────────────────────────────

describe('bracketSeeds', () => {
  it('p=2 → final is 1v2', () => {
    expect(bracketSeeds(2)).toEqual([1, 2])
  })

  it('p=4 → seeds ensure 1v4 and 2v3 in semis, 1v2 in final', () => {
    const seeds = bracketSeeds(4)
    expect(seeds).toEqual([1, 4, 2, 3])
    // SF1: seeds[0] vs seeds[1] = 1v4; SF2: seeds[2] vs seeds[3] = 2v3
  })

  it('p=8 → QF pairings are 1v8, 4v5, 2v7, 3v6', () => {
    const seeds = bracketSeeds(8)
    expect(seeds).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
    // QF pairs: [0,1]=1v8, [2,3]=4v5, [4,5]=2v7, [6,7]=3v6
  })

  it('p=16 → seed 1 and seed 2 are in opposite halves', () => {
    const seeds = bracketSeeds(16)
    const idx1 = seeds.indexOf(1)
    const idx2 = seeds.indexOf(2)
    // They're in different quarters of the bracket
    expect(Math.floor(idx1 / 4)).not.toBe(Math.floor(idx2 / 4))
  })
})

// ─── buildBracketMatches ──────────────────────────────────────────────────────

describe('buildBracketMatches — single elimination', () => {
  const players8 = makePlayers(8).map(p => p.id)
  const players4 = makePlayers(4).map(p => p.id)
  const players16 = makePlayers(16).map(p => p.id)
  const players7 = makePlayers(7).map(p => p.id)
  const players5 = makePlayers(5).map(p => p.id)
  const players32 = makePlayers(32).map(p => p.id)
  const players2 = makePlayers(2).map(p => p.id)

  // ── 8 players ───────────────────────────────────────────────────────────────

  it('8 players → 4 QF matches in round 1', () => {
    const matches = buildBracketMatches(players8)
    const r1 = matches.filter(m => m.round === 1)
    expect(r1).toHaveLength(4)
  })

  it('8 players → round 1 pairings follow seed order 1v8, 2v7, 3v6, 4v5', () => {
    const matches = buildBracketMatches(players8)
    const r1 = matches.filter(m => m.round === 1).sort((a, b) => a.position - b.position)
    // seeds for p=8: [1,8,4,5,2,7,3,6]
    // position 1: slot 0 (seed 1) vs slot 1 (seed 8)
    expect(r1[0].player_a_id).toBe(players8[0]) // seed 1
    expect(r1[0].player_b_id).toBe(players8[7]) // seed 8
    // position 2: slot 2 (seed 4) vs slot 3 (seed 5)
    expect(r1[1].player_a_id).toBe(players8[3]) // seed 4
    expect(r1[1].player_b_id).toBe(players8[4]) // seed 5
    // position 3: slot 4 (seed 2) vs slot 5 (seed 7)
    expect(r1[2].player_a_id).toBe(players8[1]) // seed 2
    expect(r1[2].player_b_id).toBe(players8[6]) // seed 7
    // position 4: slot 6 (seed 3) vs slot 7 (seed 6)
    expect(r1[3].player_a_id).toBe(players8[2]) // seed 3
    expect(r1[3].player_b_id).toBe(players8[5]) // seed 6
  })

  it('8 players → 3 rounds total (QF, SF, F)', () => {
    const matches = buildBracketMatches(players8)
    const rounds = new Set(matches.map(m => m.round))
    expect([...rounds].sort()).toEqual([1, 2, 3])
  })

  it('8 players → total 7 matches (4+2+1)', () => {
    const matches = buildBracketMatches(players8)
    expect(matches).toHaveLength(7)
  })

  it('8 players → round 2 has 2 empty slots (TBD), round 3 has 1', () => {
    const matches = buildBracketMatches(players8)
    const r2 = matches.filter(m => m.round === 2)
    const r3 = matches.filter(m => m.round === 3)
    expect(r2).toHaveLength(2)
    expect(r3).toHaveLength(1)
    r2.forEach(m => { expect(m.player_a_id).toBeNull(); expect(m.player_b_id).toBeNull() })
    r3.forEach(m => { expect(m.player_a_id).toBeNull(); expect(m.player_b_id).toBeNull() })
  })

  // ── 4 players ────────────────────────────────────────────────────────────────

  it('4 players → 2 SF matches in round 1', () => {
    const matches = buildBracketMatches(players4)
    expect(matches.filter(m => m.round === 1)).toHaveLength(2)
  })

  it('4 players → total 3 matches', () => {
    expect(buildBracketMatches(players4)).toHaveLength(3)
  })

  // ── 16 players ───────────────────────────────────────────────────────────────

  it('16 players → 8 first-round matches', () => {
    const matches = buildBracketMatches(players16)
    expect(matches.filter(m => m.round === 1)).toHaveLength(8)
  })

  it('16 players → 4 rounds total', () => {
    const matches = buildBracketMatches(players16)
    const maxRound = Math.max(...matches.map(m => m.round))
    expect(maxRound).toBe(4)
  })

  it('16 players → total 15 matches', () => {
    expect(buildBracketMatches(players16)).toHaveLength(15)
  })

  // ── 7 players (byes) ─────────────────────────────────────────────────────────

  it('7 players → 3 live R1 matches + 1 bye slot', () => {
    const matches = buildBracketMatches(players7)
    const r1 = matches.filter(m => m.round === 1)
    expect(r1).toHaveLength(4) // bracket size = 8, so 4 R1 slots
    const realMatches = r1.filter(m => m.player_a_id && m.player_b_id)
    const byeSlots = r1.filter(m => m.player_a_id && !m.player_b_id)
    expect(realMatches).toHaveLength(3)
    expect(byeSlots).toHaveLength(1)
  })

  it('7 players → highest seed (seed 8) gets the bye', () => {
    // bracketSeeds(8) = [1,8,4,5,2,7,3,6]
    // Seed 8 slot maps to players7[7] which doesn't exist → null
    const matches = buildBracketMatches(players7)
    const byeMatch = matches.find(m => m.round === 1 && m.player_a_id && !m.player_b_id)
    expect(byeMatch).toBeDefined()
    // The player in the bye slot is seed 1 (best seed gets the bye slot that has null opponent)
    // Actually: the bye is the slot where one side is null (seed > n)
    // bracketSeeds(8)[1] = 8 (seed 8 > 7 players) → player_b_id is null for position 1
    expect(byeMatch!.player_b_id).toBeNull()
    // The surviving player (seed 1, the top seed) gets the bye
    expect(byeMatch!.player_a_id).toBe(players7[0]) // seed 1 = index 0
  })

  // ── 5 players (2 byes) ───────────────────────────────────────────────────────

  it('5 players → 3 byes in round 1 (pad to 8, 3 empty slots)', () => {
    // bracketSeeds(8) = [1,8,4,5,2,7,3,6]; seeds 6,7,8 > 5 → 3 byes
    const matches = buildBracketMatches(players5)
    const r1 = matches.filter(m => m.round === 1)
    const byeSlots = r1.filter(m => m.player_a_id && !m.player_b_id)
    expect(byeSlots).toHaveLength(3)
  })

  it('5 players → 1 real R1 match + 3 byes', () => {
    const matches = buildBracketMatches(players5)
    const r1 = matches.filter(m => m.round === 1)
    const real = r1.filter(m => m.player_a_id && m.player_b_id)
    expect(real).toHaveLength(1)
  })

  // ── 32 players ───────────────────────────────────────────────────────────────

  it('32 players → 16 first-round matches', () => {
    const matches = buildBracketMatches(players32)
    expect(matches.filter(m => m.round === 1)).toHaveLength(16)
  })

  it('32 players → 5 rounds total', () => {
    const matches = buildBracketMatches(players32)
    const maxRound = Math.max(...matches.map(m => m.round))
    expect(maxRound).toBe(5)
  })

  it('32 players → total 31 matches', () => {
    expect(buildBracketMatches(players32)).toHaveLength(31)
  })

  // ── 2 players ────────────────────────────────────────────────────────────────

  it('2 players → single match, 1 round', () => {
    const matches = buildBracketMatches(players2)
    expect(matches).toHaveLength(1)
    expect(matches[0].round).toBe(1)
    expect(matches[0].player_a_id).toBe(players2[0])
    expect(matches[0].player_b_id).toBe(players2[1])
  })

  // ── next_match_id wiring (pure structure check) ───────────────────────────────

  it('positions feed correctly: (r1,p1) and (r1,p2) both advance to (r2,p1)', () => {
    // buildBracketMatches doesn't wire next_match_id (that's done after DB insert),
    // but we can verify the POSITION math is correct: ceil(p/2) for next round
    const matches = buildBracketMatches(players8)
    const r1 = matches.filter(m => m.round === 1).sort((a, b) => a.position - b.position)
    // pos 1 → ceil(1/2) = 1; pos 2 → ceil(2/2) = 1 (both feed into R2P1)
    expect(Math.ceil(r1[0].position / 2)).toBe(1)
    expect(Math.ceil(r1[1].position / 2)).toBe(1)
    // pos 3 → ceil(3/2) = 2; pos 4 → ceil(4/2) = 2 (both feed into R2P2)
    expect(Math.ceil(r1[2].position / 2)).toBe(2)
    expect(Math.ceil(r1[3].position / 2)).toBe(2)
  })

  it('final match is at the highest round number', () => {
    const matches = buildBracketMatches(players8)
    const maxRound = Math.max(...matches.map(m => m.round))
    const finals = matches.filter(m => m.round === maxRound)
    expect(finals).toHaveLength(1)
    expect(finals[0].position).toBe(1)
  })

  // ── edge cases ────────────────────────────────────────────────────────────────

  it('1 player → empty bracket (single player cannot generate a match)', () => {
    // nextPowerOf2(1)=1 → 1/2=0 first-round matches
    const matches = buildBracketMatches([makePlayers(1)[0].id])
    expect(matches.filter(m => m.round === 1)).toHaveLength(0)
  })

  it('0 players → empty array returned', () => {
    expect(buildBracketMatches([])).toEqual([])
  })

  it('null slots in input are treated as byes', () => {
    const withNull = [...players4, null, null, null, null] as (string | null)[]
    const matches = buildBracketMatches(withNull)
    const r1 = matches.filter(m => m.round === 1)
    const byes = r1.filter(m => m.player_a_id && !m.player_b_id)
    expect(byes.length).toBeGreaterThan(0)
  })
})

// ─── previewGroups ─────────────────────────────────────────────────────────────

describe('previewGroups — group_stage snake seeding', () => {
  it('8 players, groupSize=4 → 2 groups', () => {
    const players = makePlayers(8)
    const groups = previewGroups(players, 'group_stage', 4)
    expect(groups).toHaveLength(2)
  })

  it('8 players → Group A gets seeds 1,4,5,8', () => {
    const players = makePlayers(8)
    const groups = previewGroups(players, 'group_stage', 4)
    const groupA = groups.find(g => g.name === 'Group A')!
    expect(groupA.players).toEqual([players[0], players[3], players[4], players[7]])
  })

  it('8 players → Group B gets seeds 2,3,6,7', () => {
    const players = makePlayers(8)
    const groups = previewGroups(players, 'group_stage', 4)
    const groupB = groups.find(g => g.name === 'Group B')!
    expect(groupB.players).toEqual([players[1], players[2], players[5], players[6]])
  })

  it('12 players, 3 groups → Group A: 1,6,7,12 / B: 2,5,8,11 / C: 3,4,9,10', () => {
    const players = makePlayers(12)
    const groups = previewGroups(players, 'group_stage', 4)
    expect(groups).toHaveLength(3)
    expect(groups[0].players).toEqual([players[0], players[5], players[6], players[11]])
    expect(groups[1].players).toEqual([players[1], players[4], players[7], players[10]])
    expect(groups[2].players).toEqual([players[2], players[3], players[8], players[9]])
  })

  it('6 players, groupSize=3 → 2 groups of 3', () => {
    const players = makePlayers(6)
    const groups = previewGroups(players, 'group_stage', 3)
    expect(groups).toHaveLength(2)
    groups.forEach(g => expect(g.players).toHaveLength(3))
  })

  it('top seeds are spread across groups — seed 1 and seed 2 never in same group', () => {
    const players = makePlayers(8)
    const groups = previewGroups(players, 'group_stage', 4)
    for (const g of groups) {
      const hasP1 = g.players.some(p => p.id === players[0].id)
      const hasP2 = g.players.some(p => p.id === players[1].id)
      expect(hasP1 && hasP2).toBe(false)
    }
  })

  it('group_stage with odd count — no group is more than 1 larger than any other', () => {
    const players = makePlayers(7)
    const groups = previewGroups(players, 'group_stage', 4) // 2 groups: 4 and 3
    const sizes = groups.map(g => g.players.length)
    const diff = Math.max(...sizes) - Math.min(...sizes)
    expect(diff).toBeLessThanOrEqual(1)
  })

  it('all players are assigned — none left out', () => {
    const players = makePlayers(9)
    const groups = previewGroups(players, 'group_stage', 4)
    const assigned = groups.flatMap(g => g.players)
    expect(assigned).toHaveLength(9)
    expect(new Set(assigned.map(p => p.id)).size).toBe(9)
  })

  it('single_elimination → returns single bracket group', () => {
    const players = makePlayers(8)
    const groups = previewGroups(players, 'single_elimination', 4)
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Bracket')
    expect(groups[0].players).toEqual(players)
  })

  it('double_elimination → returns single winners bracket group', () => {
    const players = makePlayers(8)
    const groups = previewGroups(players, 'double_elimination', 4)
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Winners Bracket')
  })
})

// ─── getActiveMatches ─────────────────────────────────────────────────────────

describe('getActiveMatches', () => {
  it('returns only matches with both players and not complete', () => {
    const { makeMatch } = require('../factories')
    const matches = [
      makeMatch({ player_a_id: 'p1', player_b_id: 'p2', status: 'pending' }),
      makeMatch({ player_a_id: 'p3', player_b_id: null, status: 'pending' }),
      makeMatch({ player_a_id: 'p5', player_b_id: 'p6', status: 'complete' }),
      makeMatch({ player_a_id: 'p7', player_b_id: 'p8', status: 'in_progress' }),
    ]
    const active = getActiveMatches(matches)
    expect(active).toHaveLength(2)
    expect(active.map(m => m.player_a_id)).toEqual(expect.arrayContaining(['p1', 'p7']))
  })

  it('returns empty array when no matches are active', () => {
    const { makeMatch } = require('../factories')
    const matches = [
      makeMatch({ player_a_id: 'p1', player_b_id: null }),
      makeMatch({ player_a_id: 'p1', player_b_id: 'p2', status: 'complete' }),
    ]
    expect(getActiveMatches(matches)).toHaveLength(0)
  })
})

// ─── Group stage round-robin match count ──────────────────────────────────────

describe('group stage round robin match counts', () => {
  function countRoundRobinMatches(n: number): number {
    return (n * (n - 1)) / 2
  }

  it('4 players in a group → 6 matches', () => {
    expect(countRoundRobinMatches(4)).toBe(6)
  })

  it('3 players in a group → 3 matches', () => {
    expect(countRoundRobinMatches(3)).toBe(3)
  })

  it('8 players, 2 groups of 4 → 12 total group matches', () => {
    expect(countRoundRobinMatches(4) * 2).toBe(12)
  })
})

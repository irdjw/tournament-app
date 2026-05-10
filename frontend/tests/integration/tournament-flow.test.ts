/**
 * Integration tests: full tournament DB flows.
 *
 * Requires .env.test with:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (bypasses RLS for test isolation)
 *
 * These tests are skipped automatically when env vars are not present.
 */

import { supabase } from '../helpers/supabase-test-client'
import {
  createTournament,
  getOrCreateUser,
  generateTournamentStructure,
  buildBracketMatches,
  previewGroups,
} from '../../src/lib/tournaments'
import type { Tournament, Player, TournamentMatch } from '../../src/lib/tournaments'

// ─── helpers ─────────────────────────────────────────────────────────────────

const createdTournamentIds: string[] = []
const createdUserIds: string[] = []

async function cleanupTournament(id: string) {
  await supabase.from('tournament_matches').delete().eq('tournament_id', id)
  await supabase.from('tournament_participants').delete().eq('tournament_id', id)
  await supabase.from('tournament_groups').delete().eq('tournament_id', id)
  await supabase.from('tournaments').delete().eq('id', id)
}

async function cleanupUsers(ids: string[]) {
  if (ids.length === 0) return
  await supabase.from('users').delete().in('id', ids)
}

function makeUniqueName(base: string): string {
  return `${base}-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

async function createTestUser(name: string): Promise<Player> {
  const player = await getOrCreateUser(makeUniqueName(name))
  createdUserIds.push(player.id)
  return player
}

async function createTestTournament(
  name: string,
  format: 'single_elimination' | 'group_stage' = 'single_elimination',
): Promise<Tournament> {
  const t = await createTournament(
    makeUniqueName(name),
    format,
    'darts',
    { legs: 3, startingScore: 501, doubleOut: true, groupSize: 4, advanceFromGroup: 2 },
  )
  createdTournamentIds.push(t.id)
  return t
}

// ─── skip guard ──────────────────────────────────────────────────────────────

const hasCredentials =
  !!(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL) &&
  !!(
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY
  )

const describeIntegration = hasCredentials ? describe : describe.skip

// ─── afterAll cleanup ────────────────────────────────────────────────────────

afterAll(async () => {
  if (!hasCredentials) return
  for (const id of createdTournamentIds) {
    await cleanupTournament(id).catch(() => {})
  }
  await cleanupUsers(createdUserIds).catch(() => {})
})

// ─── Flow 1: Single-elimination tournament ───────────────────────────────────

describeIntegration('Flow 1 — single elimination (8 players)', () => {
  let tournament: Tournament
  let players: Player[]

  beforeAll(async () => {
    tournament = await createTestTournament('SE-Flow')
    players = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createTestUser(`player-${i + 1}`))
    )
    await generateTournamentStructure(
      tournament.id,
      players,
      'single_elimination',
      { legs: 3, startingScore: 501, doubleOut: true, groupSize: 4, advanceFromGroup: 2 },
    )
  })

  it('creates a tournament with status=setup', () => {
    expect(tournament.id).toBeTruthy()
    expect(tournament.status).toBe('setup')
    expect(tournament.format).toBe('single_elimination')
  })

  it('inserts 8 participants into tournament_participants', async () => {
    const { data, error } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournament.id)
    expect(error).toBeNull()
    expect(data).toHaveLength(8)
  })

  it('creates 7 tournament matches (8-player single elimination)', async () => {
    const { data, error } = await supabase
      .from('tournament_matches')
      .select('id, round, position, player_a_id, player_b_id, status')
      .eq('tournament_id', tournament.id)
      .order('round')
      .order('position')
    expect(error).toBeNull()
    // 8 players → 4 R1 matches + 2 R2 + 1 final = 7
    expect(data).toHaveLength(7)
  })

  it('has 4 first-round matches each with two real players', async () => {
    const { data } = await supabase
      .from('tournament_matches')
      .select('player_a_id, player_b_id')
      .eq('tournament_id', tournament.id)
      .eq('round', 1)
    expect(data).toHaveLength(4)
    data!.forEach(m => {
      expect(m.player_a_id).toBeTruthy()
      expect(m.player_b_id).toBeTruthy()
    })
  })

  it('wires next_match_id so each R1 match points to its R2 match', async () => {
    const { data } = await supabase
      .from('tournament_matches')
      .select('id, round, next_match_id')
      .eq('tournament_id', tournament.id)
      .eq('round', 1)
    expect(data).toHaveLength(4)
    data!.forEach(m => expect(m.next_match_id).toBeTruthy())
  })

  it('correctly seeds top seed vs bottom seed in R1 (1 vs 8, 2 vs 7, ...)', () => {
    const playerIds = players.map(p => p.id)
    const bracketPlayers = players.map(p => p.id) as (string | null)[]
    const bracketMatches = buildBracketMatches(bracketPlayers)

    // R1 match 1: seed 1 vs seed 8
    const r1 = bracketMatches.filter(m => m.round === 1).sort((a, b) => a.position - b.position)
    expect(r1[0].player_a_id).toBe(playerIds[0])  // seed 1
    expect(r1[0].player_b_id).toBe(playerIds[7])  // seed 8
  })
})

// ─── Flow 2: Group stage structure ───────────────────────────────────────────

describeIntegration('Flow 2 — group stage (8 players, 2 groups)', () => {
  let tournament: Tournament
  let players: Player[]

  beforeAll(async () => {
    tournament = await createTestTournament('GS-Flow', 'group_stage')
    players = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createTestUser(`gs-player-${i + 1}`))
    )
    await generateTournamentStructure(
      tournament.id,
      players,
      'group_stage',
      { legs: 3, startingScore: 501, doubleOut: true, groupSize: 4, advanceFromGroup: 2 },
    )
  })

  it('creates 2 groups in tournament_groups', async () => {
    const { data, error } = await supabase
      .from('tournament_groups')
      .select('id, name, group_type')
      .eq('tournament_id', tournament.id)
      .eq('group_type', 'group')
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
    expect(data!.map(g => g.name).sort()).toEqual(['Group A', 'Group B'])
  })

  it('creates 6 round-robin matches per group (4 players → 4c2=6)', async () => {
    const { data: groups } = await supabase
      .from('tournament_groups')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('group_type', 'group')

    expect(groups).toHaveLength(2)

    for (const group of groups!) {
      const { data: matches } = await supabase
        .from('tournament_matches')
        .select('id')
        .eq('group_id', group.id)
      // 4 players → 6 round-robin matches
      expect(matches?.length).toBe(6)
    }
  })

  it('assigns players to groups with correct snake seeding', () => {
    // Pure function check: seeds 1,4,5,8 → Group A; 2,3,6,7 → Group B
    const groups = previewGroups(players, 'group_stage', 4)
    const groupASeeds = groups[0].players.map(p => players.indexOf(p) + 1)
    const groupBSeeds = groups[1].players.map(p => players.indexOf(p) + 1)

    expect(groupASeeds.sort((a, b) => a - b)).toEqual([1, 4, 5, 8])
    expect(groupBSeeds.sort((a, b) => a - b)).toEqual([2, 3, 6, 7])
  })
})

// ─── Flow 3: Standings accumulation ──────────────────────────────────────────

describeIntegration('Flow 3 — standings accumulation', () => {
  it('updates match records can be fetched for completed matches', async () => {
    // Create a single tournament match manually and mark it complete, verifying
    // that the DB round-trips correctly — this validates our schema assumptions
    const tournament = await createTestTournament('Standings-Flow')
    const [playerA, playerB] = await Promise.all([
      createTestUser('standings-a'),
      createTestUser('standings-b'),
    ])

    // Insert a single tournament match
    const { data: match, error: mErr } = await supabase
      .from('tournament_matches')
      .insert({
        tournament_id: tournament.id,
        group_id: null,
        match_id: null,
        round: 1,
        position: 1,
        player_a_id: playerA.id,
        player_b_id: playerB.id,
        winner_id: null,
        status: 'pending',
      })
      .select()
      .single()
    expect(mErr).toBeNull()
    expect(match).toBeTruthy()

    // Advance the match: player A wins
    const { error: wErr } = await supabase
      .from('tournament_matches')
      .update({ winner_id: playerA.id, status: 'complete' })
      .eq('id', match!.id)
    expect(wErr).toBeNull()

    // Verify the completed match is readable
    const { data: completed } = await supabase
      .from('tournament_matches')
      .select('winner_id, status')
      .eq('id', match!.id)
      .single()
    expect(completed?.winner_id).toBe(playerA.id)
    expect(completed?.status).toBe('complete')
  })

  it('can count completed matches per player from the DB', async () => {
    const tournament = await createTestTournament('Standings-Count')
    const [p1, p2, p3] = await Promise.all([
      createTestUser('sc-p1'),
      createTestUser('sc-p2'),
      createTestUser('sc-p3'),
    ])

    // Insert two completed matches: p1 beats p2, p1 beats p3
    await supabase.from('tournament_matches').insert([
      {
        tournament_id: tournament.id, round: 1, position: 1,
        player_a_id: p1.id, player_b_id: p2.id,
        winner_id: p1.id, status: 'complete',
      },
      {
        tournament_id: tournament.id, round: 1, position: 2,
        player_a_id: p1.id, player_b_id: p3.id,
        winner_id: p1.id, status: 'complete',
      },
    ])

    const { data } = await supabase
      .from('tournament_matches')
      .select('winner_id')
      .eq('tournament_id', tournament.id)
      .eq('status', 'complete')

    expect(data).toHaveLength(2)
    const winsPerPlayer = new Map<string, number>()
    data!.forEach(m => {
      if (m.winner_id) winsPerPlayer.set(m.winner_id, (winsPerPlayer.get(m.winner_id) ?? 0) + 1)
    })
    expect(winsPerPlayer.get(p1.id)).toBe(2)
    expect(winsPerPlayer.get(p2.id)).toBeUndefined()
  })
})

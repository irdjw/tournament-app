import { supabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'group_stage'

export interface TournamentConfig {
  legs: number
  startingScore: 301 | 501
  doubleOut: boolean
  groupSize: number
}

export interface Player {
  id: string
  name: string
}

export interface Tournament {
  id: string
  name: string
  format: TournamentFormat
  status: 'setup' | 'active' | 'complete'
  sport_id: string
  venue_id: string
  config: TournamentConfig
  created_at: string
}

export interface TournamentGroup {
  id: string
  tournament_id: string
  name: string
  group_type: string
}

export interface TournamentParticipant {
  id: string
  tournament_id: string
  user_id: string
  seed: number
  group_id: string | null
  status: string
  user?: Player
}

export interface TournamentMatch {
  id: string
  tournament_id: string
  group_id: string | null
  match_id: string | null
  round: number
  position: number
  player_a_id: string | null
  player_b_id: string | null
  winner_id: string | null
  loser_id: string | null
  next_match_id: string | null
  loser_next_match_id: string | null
  station: string | null
  status: string
  player_a?: Player | null
  player_b?: Player | null
  winner?: Player | null
  group?: TournamentGroup | null
}

export interface FullTournamentData {
  tournament: Tournament
  groups: TournamentGroup[]
  participants: TournamentParticipant[]
  matches: TournamentMatch[]
}

export interface GroupPreview {
  name: string
  players: Player[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

async function getOrCreateDefaultVenue(): Promise<string> {
  let { data } = await supabase.from('venues').select('id').limit(1).single()
  if (data) return data.id
  const { data: created, error } = await supabase
    .from('venues').insert({ name: 'Default Venue' }).select('id').single()
  if (error) throw error
  return created.id
}

async function getOrCreateSport(sport: string): Promise<string> {
  let { data } = await supabase.from('sports').select('id').eq('name', sport).single()
  if (data) return data.id
  const { data: created, error } = await supabase
    .from('sports').insert({ name: sport }).select('id').single()
  if (error) throw error
  return created.id
}

export async function getOrCreateUser(name: string): Promise<Player> {
  const email = `${name.toLowerCase().replace(/\s+/g, '')}@temp.com`
  const { data, error } = await supabase
    .from('users')
    .upsert({ name, email }, { onConflict: 'email' })
    .select('id, name')
    .single()
  if (error) throw error
  return data as Player
}

// ─── Tournament CRUD ──────────────────────────────────────────────────────────

export async function createTournament(
  name: string,
  format: TournamentFormat,
  sport: string,
  config: TournamentConfig,
): Promise<Tournament> {
  const [venueId, sportId] = await Promise.all([
    getOrCreateDefaultVenue(),
    getOrCreateSport(sport),
  ])
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ name, format, venue_id: venueId, sport_id: sportId, status: 'setup', config })
    .select()
    .single()
  if (error) throw error
  return data as Tournament
}

export async function startTournament(tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', tournamentId)
  if (error) throw error
}

export async function getTournamentFull(id: string): Promise<FullTournamentData> {
  const [{ data: tournament, error: tErr }, { data: groups, error: gErr }, { data: participants, error: pErr }, { data: matches, error: mErr }] =
    await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase.from('tournament_groups').select('*').eq('tournament_id', id),
      supabase
        .from('tournament_participants')
        .select('*, user:user_id(id, name)')
        .eq('tournament_id', id)
        .order('seed'),
      supabase
        .from('tournament_matches')
        .select(`
          *,
          player_a:player_a_id(id, name),
          player_b:player_b_id(id, name),
          winner:winner_id(id, name),
          group:group_id(id, name, group_type)
        `)
        .eq('tournament_id', id)
        .order('round')
        .order('position'),
    ])
  if (tErr) throw tErr
  if (gErr) throw gErr
  if (pErr) throw pErr
  if (mErr) throw mErr
  return {
    tournament: tournament as unknown as Tournament,
    groups: (groups ?? []) as TournamentGroup[],
    participants: (participants ?? []) as unknown as TournamentParticipant[],
    matches: (matches ?? []) as unknown as TournamentMatch[],
  }
}

// ─── Group preview (client-side, no DB) ──────────────────────────────────────

export function previewGroups(players: Player[], format: TournamentFormat, groupSize: number): GroupPreview[] {
  if (format !== 'group_stage') {
    return [{ name: 'Bracket', players }]
  }
  const gs = Math.max(2, groupSize || 4)
  const numGroups = Math.ceil(players.length / gs)
  const groups: GroupPreview[] = []
  for (let i = 0; i < numGroups; i++) {
    groups.push({
      name: `Group ${String.fromCharCode(65 + i)}`,
      players: [],
    })
  }
  // Serpentine distribution
  players.forEach((p, i) => {
    const g = i % numGroups
    groups[g].players.push(p)
  })
  return groups
}

// ─── Generate Tournament Structure ────────────────────────────────────────────

export async function generateTournamentStructure(
  tournamentId: string,
  players: Player[],
  format: TournamentFormat,
  config: TournamentConfig,
): Promise<void> {
  const playerIds = players.map(p => p.id)
  const n = playerIds.length

  if (format === 'group_stage') {
    await generateGroupStageStructure(tournamentId, players, config.groupSize || 4)
  } else if (format === 'single_elimination') {
    const { data: group, error } = await supabase
      .from('tournament_groups')
      .insert({ tournament_id: tournamentId, name: 'Main Bracket', group_type: 'winners' })
      .select()
      .single()
    if (error) throw error

    // Insert participants
    await supabase.from('tournament_participants').insert(
      playerIds.map((uid, i) => ({
        tournament_id: tournamentId,
        user_id: uid,
        seed: i + 1,
        group_id: group.id,
        status: 'active',
      }))
    )
    await generateSingleElimBracket(tournamentId, group.id, playerIds)
  } else if (format === 'double_elimination') {
    const [wbRes, lbRes, gfRes] = await Promise.all([
      supabase.from('tournament_groups').insert({ tournament_id: tournamentId, name: 'Winners Bracket', group_type: 'winners' }).select().single(),
      supabase.from('tournament_groups').insert({ tournament_id: tournamentId, name: 'Losers Bracket', group_type: 'losers' }).select().single(),
      supabase.from('tournament_groups').insert({ tournament_id: tournamentId, name: 'Grand Final', group_type: 'grand_final' }).select().single(),
    ])
    if (wbRes.error) throw wbRes.error
    if (lbRes.error) throw lbRes.error
    if (gfRes.error) throw gfRes.error

    await supabase.from('tournament_participants').insert(
      playerIds.map((uid, i) => ({
        tournament_id: tournamentId,
        user_id: uid,
        seed: i + 1,
        group_id: wbRes.data.id,
        status: 'active',
      }))
    )
    await generateDoubleElimBracket(tournamentId, wbRes.data.id, lbRes.data.id, gfRes.data.id, playerIds)
  }
}

// ─── Single Elimination Bracket ───────────────────────────────────────────────

async function generateSingleElimBracket(
  tournamentId: string,
  groupId: string,
  players: string[],
): Promise<void> {
  const n = players.length
  const size = nextPow2(n)
  const numRounds = Math.log2(size)

  // Map "round:position" -> DB id
  const matchIdMap = new Map<string, string>()

  // Insert from final (highest round) down to round 1
  for (let r = numRounds; r >= 1; r--) {
    const matchCount = size / Math.pow(2, r)
    const toInsert = []
    for (let p = 0; p < matchCount; p++) {
      const nextId = r < numRounds ? (matchIdMap.get(`${r + 1}:${Math.floor(p / 2)}`) ?? null) : null
      toInsert.push({
        tournament_id: tournamentId,
        group_id: groupId,
        round: r,
        position: p,
        player_a_id: null,
        player_b_id: null,
        next_match_id: nextId,
        status: 'pending',
      })
    }
    const { data, error } = await supabase
      .from('tournament_matches')
      .insert(toInsert)
      .select('id, round, position')
    if (error) throw error
    for (const m of data) {
      matchIdMap.set(`${m.round}:${m.position}`, m.id)
    }
  }

  // Assign players to round 1 and handle byes
  await assignPlayersToRound1(matchIdMap, players, size, numRounds)
}

async function assignPlayersToRound1(
  matchIdMap: Map<string, string>,
  players: string[],
  size: number,
  numRounds: number,
): Promise<void> {
  const n = players.length
  const matchCount = size / 2

  for (let p = 0; p < matchCount; p++) {
    const aIdx = p
    const bIdx = size - 1 - p
    const playerA = aIdx < n ? players[aIdx] : null
    const playerB = bIdx < n ? players[bIdx] : null
    const id = matchIdMap.get(`1:${p}`)!

    if (playerA === null && playerB === null) {
      // Both bye – shouldn't happen for valid n but skip gracefully
      continue
    }

    if (playerA === null || playerB === null) {
      // One-sided bye: auto-advance the real player
      const winner = (playerA ?? playerB)!
      const nextMatchId = numRounds > 1 ? (matchIdMap.get(`2:${Math.floor(p / 2)}`) ?? null) : null
      await supabase
        .from('tournament_matches')
        .update({ player_a_id: playerA, player_b_id: playerB, winner_id: winner, status: 'complete' })
        .eq('id', id)
      if (nextMatchId) {
        const isASlot = p % 2 === 0
        await supabase
          .from('tournament_matches')
          .update(isASlot ? { player_a_id: winner } : { player_b_id: winner })
          .eq('id', nextMatchId)
      }
    } else {
      await supabase
        .from('tournament_matches')
        .update({ player_a_id: playerA, player_b_id: playerB })
        .eq('id', id)
    }
  }
}

// ─── Double Elimination Bracket ───────────────────────────────────────────────

async function generateDoubleElimBracket(
  tournamentId: string,
  wbGroupId: string,
  lbGroupId: string,
  gfGroupId: string,
  players: string[],
): Promise<void> {
  const n = players.length
  const size = nextPow2(n)
  const R = Math.log2(size) // number of WB rounds

  // Map "WB:round:position" and "LB:round:position" -> DB id
  const wbMap = new Map<string, string>()
  const lbMap = new Map<string, string>()

  // 1. Create Grand Final first (no next_match_id)
  const { data: gfData, error: gfErr } = await supabase
    .from('tournament_matches')
    .insert({ tournament_id: tournamentId, group_id: gfGroupId, round: 1, position: 0, status: 'pending' })
    .select('id')
    .single()
  if (gfErr) throw gfErr
  const gfId = gfData.id

  // 2. Create LB matches from LB final → LB R1
  // LB has 2*(R-1) rounds. lbMatchCount[lbR] = 2^(R-2-floor((lbR-1)/2))
  const lbRounds = 2 * (R - 1)
  for (let lbR = lbRounds; lbR >= 1; lbR--) {
    // Match count decreases every 2 rounds starting from LB R1
    const lbMatchCount = Math.max(1, Math.pow(2, R - 2 - Math.floor((lbR - 1) / 2)))
    const toInsert = []
    for (let p = 0; p < lbMatchCount; p++) {
      let nextId: string | null = null
      if (lbR === lbRounds) {
        // LB final → Grand Final (playerB slot)
        nextId = gfId
      } else {
        // Calculate next LB match
        const nextLbR = lbR + 1
        const nextLbMatchCount = Math.max(1, Math.pow(2, R - 2 - Math.floor((nextLbR - 1) / 2)))
        const nextP = lbMatchCount > nextLbMatchCount ? Math.floor(p / 2) : p
        nextId = lbMap.get(`${nextLbR}:${nextP}`) ?? null
      }
      toInsert.push({
        tournament_id: tournamentId,
        group_id: lbGroupId,
        round: lbR,
        position: p,
        player_a_id: null,
        player_b_id: null,
        next_match_id: nextId,
        status: 'pending',
      })
    }
    const { data, error } = await supabase
      .from('tournament_matches')
      .insert(toInsert)
      .select('id, round, position')
    if (error) throw error
    for (const m of data) {
      lbMap.set(`${m.round}:${m.position}`, m.id)
    }
  }

  // 3. Create WB matches from WB final → WB R1 (with loser_next_match_id pointing to LB)
  for (let wbR = R; wbR >= 1; wbR--) {
    const wbMatchCount = size / Math.pow(2, wbR)
    const toInsert = []
    for (let p = 0; p < wbMatchCount; p++) {
      const nextWbId = wbR < R ? (wbMap.get(`${wbR + 1}:${Math.floor(p / 2)}`) ?? null) : null

      // Compute where the loser from this WB match drops in the LB
      // WB R1 losers → LB R1 (players pair up: p → position floor(p/2))
      // WB R2..R-1 losers → LB (2*wbR-1) → one loser per LB match
      // WB R (final) loser → LB final (LB round 2*(R-1)) position 0
      let loserNextId: string | null = null
      if (wbR === 1) {
        // WB R1 losers → LB R1, grouped in pairs
        const lbPos = Math.floor(p / 2)
        loserNextId = lbMap.get(`1:${lbPos}`) ?? null
      } else if (wbR < R) {
        // WB R(k) loser → LB round (2*k-2), same position as WB match
        const lbR = 2 * (wbR - 1)
        loserNextId = lbMap.get(`${lbR}:${p}`) ?? null
      } else {
        // WB Final loser → LB final (round lbRounds, position 0)
        loserNextId = lbMap.get(`${lbRounds}:0`) ?? null
      }

      toInsert.push({
        tournament_id: tournamentId,
        group_id: wbGroupId,
        round: wbR,
        position: p,
        player_a_id: null,
        player_b_id: null,
        next_match_id: nextWbId,
        loser_next_match_id: loserNextId,
        status: 'pending',
      })
    }
    const { data, error } = await supabase
      .from('tournament_matches')
      .insert(toInsert)
      .select('id, round, position')
    if (error) throw error
    for (const m of data) {
      wbMap.set(`${m.round}:${m.position}`, m.id)
    }
  }

  // Patch Grand Final: WB champion goes to playerA slot
  // (the GF already has next_match_id=null; WB Final's next_match_id already points to GF)
  // Patch WB Final's next_match_id to GF
  const wbFinalId = wbMap.get(`${R}:0`)
  if (wbFinalId) {
    await supabase.from('tournament_matches').update({ next_match_id: gfId }).eq('id', wbFinalId)
  }

  // 4. Assign round 1 players + handle byes (same as single elim)
  await assignPlayersToRound1(wbMap, players, size, R)

  // 5. Pre-populate LB R1 with WB R1 loser positions (player slots filled when WB R1 completes)
  // The loser_next_match_id on WB R1 matches already points to LB R1 positions.
  // We need to set whether the loser goes to playerA or playerB of that LB match.
  // WB R1 match at position p → LB R1 match at position floor(p/2)
  // p=0 → LB R1 M0 playerA, p=1 → LB R1 M0 playerB
  // p=2 → LB R1 M1 playerA, p=3 → LB R1 M1 playerB
  // This assignment is implicit in the recordMatchResult function.
}

// ─── Group Stage Structure ─────────────────────────────────────────────────────

async function generateGroupStageStructure(
  tournamentId: string,
  players: Player[],
  groupSize: number,
): Promise<void> {
  const gs = Math.max(2, groupSize || 4)
  const numGroups = Math.ceil(players.length / gs)
  const groupAssignments: Array<{ groupId: string; players: Player[] }> = []

  // Create groups
  for (let i = 0; i < numGroups; i++) {
    const { data, error } = await supabase
      .from('tournament_groups')
      .insert({ tournament_id: tournamentId, name: `Group ${String.fromCharCode(65 + i)}`, group_type: 'group' })
      .select()
      .single()
    if (error) throw error
    groupAssignments.push({ groupId: data.id, players: [] })
  }

  // Serpentine player distribution
  players.forEach((p, i) => {
    groupAssignments[i % numGroups].players.push(p)
  })

  // Insert participants + create round-robin matches
  for (const ga of groupAssignments) {
    const { groupId, players: gPlayers } = ga

    await supabase.from('tournament_participants').insert(
      gPlayers.map((p, i) => ({
        tournament_id: tournamentId,
        user_id: p.id,
        seed: players.indexOf(p) + 1,
        group_id: groupId,
        status: 'active',
      }))
    )

    // Round-robin matches
    const roundRobinMatches = []
    for (let a = 0; a < gPlayers.length; a++) {
      for (let b = a + 1; b < gPlayers.length; b++) {
        roundRobinMatches.push({
          tournament_id: tournamentId,
          group_id: groupId,
          round: 1,
          position: roundRobinMatches.length,
          player_a_id: gPlayers[a].id,
          player_b_id: gPlayers[b].id,
          status: 'pending',
        })
      }
    }
    if (roundRobinMatches.length > 0) {
      const { error } = await supabase.from('tournament_matches').insert(roundRobinMatches)
      if (error) throw error
    }
  }
}

// ─── Match Scoring ────────────────────────────────────────────────────────────

export async function createMatchForTournamentSlot(
  tournamentMatchId: string,
  sportId: string,
  venueId: string,
  config: TournamentConfig,
  playerAId: string,
  playerBId: string,
): Promise<string> {
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({
      venue_id: venueId,
      sport_id: sportId,
      match_type: 'tournament',
      status: 'pending',
      legs_to_win: config.legs,
      starting_score: config.startingScore,
      current_leg: 1,
    })
    .select()
    .single()
  if (matchError) throw matchError

  const { error: mpError } = await supabase.from('match_players').insert([
    { match_id: match.id, user_id: playerAId, team_id: 'team_a', legs_won: 0 },
    { match_id: match.id, user_id: playerBId, team_id: 'team_b', legs_won: 0 },
  ])
  if (mpError) throw mpError

  await supabase.from('tournament_matches').update({ match_id: match.id, status: 'in_progress' }).eq('id', tournamentMatchId)
  return match.id
}

// ─── Record Match Result ──────────────────────────────────────────────────────

export async function recordTournamentMatchResult(
  tournamentMatchId: string,
  winnerId: string,
  loserId: string,
): Promise<void> {
  // 1. Update this tournament_match
  const { data: tm, error: fetchError } = await supabase
    .from('tournament_matches')
    .select('next_match_id, loser_next_match_id, position, round, group_id')
    .eq('id', tournamentMatchId)
    .single()
  if (fetchError) throw fetchError

  await supabase
    .from('tournament_matches')
    .update({ winner_id: winnerId, loser_id: loserId, status: 'complete' })
    .eq('id', tournamentMatchId)

  // 2. Propagate winner to next WB/LB match
  if (tm.next_match_id) {
    // Figure out which slot (A or B) the winner fills
    // The winner fills playerA if this match's position is even, playerB if odd
    const isASlot = tm.position % 2 === 0
    const nextMatchCurrent = await supabase
      .from('tournament_matches')
      .select('player_a_id, player_b_id')
      .eq('id', tm.next_match_id)
      .single()
    if (!nextMatchCurrent.error) {
      const update: Record<string, string> = {}
      if (isASlot && !nextMatchCurrent.data.player_a_id) {
        update.player_a_id = winnerId
      } else if (!isASlot && !nextMatchCurrent.data.player_b_id) {
        update.player_b_id = winnerId
      } else if (!nextMatchCurrent.data.player_a_id) {
        update.player_a_id = winnerId
      } else {
        update.player_b_id = winnerId
      }
      if (Object.keys(update).length > 0) {
        await supabase.from('tournament_matches').update(update).eq('id', tm.next_match_id)
      }
    }
  }

  // 3. Propagate loser to LB (double elimination)
  if (tm.loser_next_match_id) {
    // Loser fills playerA if match position is even within a pair, otherwise playerB
    const lbSlotIsA = tm.position % 2 === 0
    const lbCurrent = await supabase
      .from('tournament_matches')
      .select('player_a_id, player_b_id')
      .eq('id', tm.loser_next_match_id)
      .single()
    if (!lbCurrent.error) {
      const update: Record<string, string> = {}
      if (lbSlotIsA && !lbCurrent.data.player_a_id) {
        update.player_a_id = loserId
      } else if (!lbSlotIsA && !lbCurrent.data.player_b_id) {
        update.player_b_id = loserId
      } else if (!lbCurrent.data.player_a_id) {
        update.player_a_id = loserId
      } else {
        update.player_b_id = loserId
      }
      if (Object.keys(update).length > 0) {
        await supabase.from('tournament_matches').update(update).eq('id', tm.loser_next_match_id)
      }
    }
  }
}

// ─── After Group Stage: Generate Knockout ─────────────────────────────────────

export async function generateKnockoutFromGroups(
  tournamentId: string,
  advancePerGroup: number = 2,
): Promise<void> {
  // Get all groups of type 'group'
  const { data: groups, error: gErr } = await supabase
    .from('tournament_groups')
    .select('id, name')
    .eq('tournament_id', tournamentId)
    .eq('group_type', 'group')
  if (gErr) throw gErr

  // Get group stage matches + results
  const { data: matches, error: mErr } = await supabase
    .from('tournament_matches')
    .select('*, player_a:player_a_id(id, name), player_b:player_b_id(id, name), winner:winner_id(id, name)')
    .eq('tournament_id', tournamentId)
    .in('group_id', groups!.map(g => g.id))
  if (mErr) throw mErr

  // Compute group standings (by wins)
  const standingsMap = new Map<string, Map<string, number>>() // groupId -> {playerId -> wins}
  for (const g of groups!) {
    standingsMap.set(g.id, new Map())
  }
  for (const m of matches ?? []) {
    if (m.winner_id && m.group_id) {
      const gs = standingsMap.get(m.group_id)!
      gs.set(m.winner_id, (gs.get(m.winner_id) ?? 0) + 1)
    }
  }

  // Collect top N from each group
  const advancingPlayers: string[] = []
  for (const g of groups!) {
    const gStandings = standingsMap.get(g.id)!
    const sorted = [...gStandings.entries()].sort((a, b) => b[1] - a[1])
    sorted.slice(0, advancePerGroup).forEach(([pid]) => advancingPlayers.push(pid))
  }

  // Create knockout bracket group
  const { data: kbGroup, error: kbErr } = await supabase
    .from('tournament_groups')
    .insert({ tournament_id: tournamentId, name: 'Knockout', group_type: 'winners' })
    .select()
    .single()
  if (kbErr) throw kbErr

  await generateSingleElimBracket(tournamentId, kbGroup.id, advancingPlayers)
}

// ─── List Tournaments ─────────────────────────────────────────────────────────

export async function listTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Tournament[]
}

// ─── Helpers for Control Page ─────────────────────────────────────────────────

/**
 * Check if all pending matches for a given group are complete
 */
export function allMatchesComplete(matches: TournamentMatch[], groupId?: string): boolean {
  const relevant = groupId ? matches.filter(m => m.group_id === groupId) : matches
  const active = relevant.filter(m => m.status !== 'complete' && (m.player_a_id || m.player_b_id))
  return active.length === 0 && relevant.length > 0
}

/**
 * Get currently active (non-bye, non-complete) matches
 */
export function getActiveMatches(matches: TournamentMatch[]): TournamentMatch[] {
  return matches.filter(
    m => m.player_a_id && m.player_b_id && m.status !== 'complete'
  )
}

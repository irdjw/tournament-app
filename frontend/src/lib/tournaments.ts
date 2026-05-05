import { supabase } from './supabase'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TournamentConfig {
  legs: number
  startingScore: number
  doubleOut: boolean
  playersPerGroup: number
  advanceFromGroup: number
}

export type TournamentFormat = 'single_elim' | 'double_elim' | 'group_to_parallel_elim'
export type TournamentStatus = 'setup' | 'group' | 'brackets' | 'complete'
export type GroupType = 'group' | 'winners' | 'losers'

export interface Tournament {
  id: string
  venue_id: string
  sport_id: string
  name: string
  format: TournamentFormat
  status: TournamentStatus
  config: TournamentConfig
  created_at: string
}

export interface TournamentGroup {
  id: string
  tournament_id: string
  name: string
  group_type: GroupType
}

export interface TournamentParticipant {
  id: string
  tournament_id: string
  user_id: string
  seed: number | null
  group_id: string | null
  status: 'active' | 'eliminated' | 'won'
  users?: { id: string; name: string }
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
  status: 'pending' | 'in_progress' | 'complete'
}

/** Intermediate structure used by buildBracketMatches (pure, no DB IDs yet). */
export interface BracketMatch {
  round: number
  position: number
  player_a_id: string | null
  player_b_id: string | null
}

export interface TournamentState {
  tournament: Tournament
  groups: TournamentGroup[]
  participants: TournamentParticipant[]
  matches: TournamentMatch[]
  phase: TournamentStatus
  /** Lowest round number that still has incomplete matches in the current phase. */
  currentRound: number
}

// ─── Pure bracket utilities ───────────────────────────────────────────────────

/** Returns the smallest power of 2 that is >= n. */
export function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/**
 * Returns seed numbers arranged in bracket slot order for a seeded
 * single-elimination bracket of size `p` (must be a power of 2).
 *
 * Guarantees that seeds 1 and 2 can only meet in the final, assuming
 * higher-seeded players always win.
 *
 * Algorithm: recursive doubling. Base: [1].
 * Each step interleaves every existing seed s with its complement (p+1-s).
 * This pushes s and its complement to opposite halves of the bracket.
 *
 * p=2 → [1, 2]            R1: 1v2          Final only
 * p=4 → [1, 4, 2, 3]      R1: 1v4, 2v3     → Final: 1v2
 * p=8 → [1,8,4,5,2,7,3,6] R1: 1v8,4v5,2v7,3v6  → SF: 1v4,2v3 → Final: 1v2
 */
export function bracketSeeds(p: number): number[] {
  if (p === 1) return [1]
  const prev = bracketSeeds(p / 2)
  const result: number[] = []
  for (const seed of prev) {
    result.push(seed)
    result.push(p + 1 - seed)
  }
  return result
}

/**
 * Generates the full match skeleton for a seeded single-elimination bracket.
 *
 * Byes are assigned to the weakest seeds so the strongest players get the
 * free first round. A bye match has player_b_id = null.
 *
 * Wiring rule: the match at (round r, position p) advances its winner into
 * (round r+1, position ⌈p/2⌉). The winner fills slot A if p is odd, slot B
 * if p is even.
 *
 * @param players Player IDs in seed order (index 0 = seed 1).
 *   Array length need not be a power of 2; missing entries become byes.
 */
export function buildBracketMatches(players: (string | null)[]): BracketMatch[] {
  const n = players.length
  const p = nextPowerOf2(n)
  const seeds = bracketSeeds(p)

  // Map bracket slot → player (seeds beyond n are byes/null)
  const slots = seeds.map(seed => (seed <= n ? players[seed - 1] : null))

  const totalRounds = Math.log2(p)
  const matches: BracketMatch[] = []

  // Round 1: pair adjacent slots
  for (let pos = 1; pos <= p / 2; pos++) {
    matches.push({
      round: 1,
      position: pos,
      player_a_id: slots[(pos - 1) * 2],
      player_b_id: slots[(pos - 1) * 2 + 1],
    })
  }

  // Later rounds — players are filled in by advanceWinner
  for (let round = 2; round <= totalRounds; round++) {
    const count = p / Math.pow(2, round)
    for (let pos = 1; pos <= count; pos++) {
      matches.push({ round, position: pos, player_a_id: null, player_b_id: null })
    }
  }

  return matches
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function getDefaultVenueAndSport(): Promise<{ venueId: string; sportId: string }> {
  const [{ data: venue }, { data: sport }] = await Promise.all([
    supabase.from('venues').select('id').limit(1).single(),
    supabase.from('sports').select('id').eq('name', 'darts').single(),
  ])
  if (!venue) throw new Error('No venue found — create one first')
  if (!sport) throw new Error('Darts sport not found')
  return { venueId: venue.id, sportId: sport.id }
}

async function createUnderlyingMatch(
  playerAId: string,
  playerBId: string,
  config: TournamentConfig,
  venueId: string,
  sportId: string,
): Promise<string> {
  const { data: match, error: mErr } = await supabase
    .from('matches')
    .insert({
      venue_id: venueId,
      sport_id: sportId,
      match_type: 'tournament',
      status: 'pending',
      legs_to_win: config.legs,
      current_leg: 1,
    })
    .select('id')
    .single()
  if (mErr) throw mErr

  const { error: mpErr } = await supabase.from('match_players').insert([
    { match_id: match.id, user_id: playerAId, team_id: 'team_a', legs_won: 0 },
    { match_id: match.id, user_id: playerBId, team_id: 'team_b', legs_won: 0 },
  ])
  if (mpErr) throw mpErr

  return match.id
}

/**
 * Inserts bracket matches into tournament_matches, wires next_match_id
 * relationships, creates underlying match records where both players are
 * already known (non-bye round-1 matches), and auto-advances byes.
 */
async function insertAndWireBracket(
  groupId: string,
  tournamentId: string,
  bracketMatches: BracketMatch[],
  config: TournamentConfig,
  venueId: string,
  sportId: string,
): Promise<TournamentMatch[]> {
  // 1. Bulk-insert all match skeletons
  const { data: rows, error: insErr } = await supabase
    .from('tournament_matches')
    .insert(
      bracketMatches.map(m => ({
        group_id: groupId,
        tournament_id: tournamentId,
        round: m.round,
        position: m.position,
        player_a_id: m.player_a_id,
        player_b_id: m.player_b_id,
        status: 'pending',
      }))
    )
    .select()
  if (insErr) throw insErr

  const inserted = rows as TournamentMatch[]
  const maxRound = Math.max(...inserted.map(r => r.round))

  // 2. Wire next_match_id: (round r, pos p) → (round r+1, pos ⌈p/2⌉)
  const idAt = (round: number, pos: number) =>
    inserted.find(r => r.round === round && r.position === pos)?.id ?? null

  await Promise.all(
    inserted
      .filter(r => r.round < maxRound)
      .map(r => {
        const nextId = idAt(r.round + 1, Math.ceil(r.position / 2))
        if (!nextId) return Promise.resolve()
        return supabase
          .from('tournament_matches')
          .update({ next_match_id: nextId })
          .eq('id', r.id)
          .then(({ error: e }) => { if (e) throw e })
      })
  )

  // 3. Create underlying match records for round-1 matches with two real players
  const round1Real = inserted.filter(r => r.round === 1 && r.player_a_id && r.player_b_id)
  await Promise.all(
    round1Real.map(async r => {
      const matchId = await createUnderlyingMatch(r.player_a_id!, r.player_b_id!, config, venueId, sportId)
      await supabase.from('tournament_matches').update({ match_id: matchId }).eq('id', r.id)
    })
  )

  // 4. Auto-advance byes (round-1 matches with no player_b)
  const byeMatches = inserted.filter(r => r.round === 1 && r.player_a_id && !r.player_b_id)
  for (const bye of byeMatches) {
    const nextId = idAt(bye.round + 1, Math.ceil(bye.position / 2))
    const isSlotA = bye.position % 2 === 1
    await supabase
      .from('tournament_matches')
      .update({ winner_id: bye.player_a_id, status: 'complete' })
      .eq('id', bye.id)
    if (nextId) {
      await supabase
        .from('tournament_matches')
        .update(isSlotA ? { player_a_id: bye.player_a_id } : { player_b_id: bye.player_a_id })
        .eq('id', nextId)
    }
  }

  // Re-fetch so callers get the wired state
  const { data: final } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('group_id', groupId)
    .order('round')
    .order('position')

  return (final as TournamentMatch[]) ?? inserted
}

// ─── Group standings ──────────────────────────────────────────────────────────

interface GroupStanding {
  userId: string
  wins: number
  losses: number
  legsFor: number
  legsAgainst: number
}

async function computeGroupStandings(groupId: string): Promise<GroupStanding[]> {
  const { data: tMatches } = await supabase
    .from('tournament_matches')
    .select('player_a_id, player_b_id, winner_id, match_id')
    .eq('group_id', groupId)
    .eq('status', 'complete')

  if (!tMatches?.length) return []

  const stats = new Map<string, GroupStanding>()
  const ensure = (userId: string) => {
    if (!stats.has(userId))
      stats.set(userId, { userId, wins: 0, losses: 0, legsFor: 0, legsAgainst: 0 })
    return stats.get(userId)!
  }

  // Fetch leg data for all underlying matches at once
  const matchIds = tMatches.map(m => m.match_id).filter(Boolean) as string[]
  const legsByMatch = new Map<string, { userId: string; legsWon: number }[]>()

  if (matchIds.length > 0) {
    const { data: mpData } = await supabase
      .from('match_players')
      .select('match_id, user_id, legs_won')
      .in('match_id', matchIds)

    for (const mp of mpData ?? []) {
      if (!legsByMatch.has(mp.match_id)) legsByMatch.set(mp.match_id, [])
      legsByMatch.get(mp.match_id)!.push({ userId: mp.user_id, legsWon: mp.legs_won ?? 0 })
    }
  }

  for (const m of tMatches) {
    const aId = m.player_a_id
    const bId = m.player_b_id
    if (!aId || !bId) continue

    ensure(aId)
    ensure(bId)

    if (m.winner_id === aId) { stats.get(aId)!.wins++; stats.get(bId)!.losses++ }
    else if (m.winner_id === bId) { stats.get(bId)!.wins++; stats.get(aId)!.losses++ }

    if (m.match_id) {
      const legs = legsByMatch.get(m.match_id) ?? []
      const aLegs = legs.find(l => l.userId === aId)?.legsWon ?? 0
      const bLegs = legs.find(l => l.userId === bId)?.legsWon ?? 0
      stats.get(aId)!.legsFor += aLegs
      stats.get(aId)!.legsAgainst += bLegs
      stats.get(bId)!.legsFor += bLegs
      stats.get(bId)!.legsAgainst += aLegs
    }
  }

  return [...stats.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    return (b.legsFor - b.legsAgainst) - (a.legsFor - a.legsAgainst)
  })
}

// ─── Exported API ─────────────────────────────────────────────────────────────

export async function createTournament(
  venueId: string,
  sportId: string,
  name: string,
  format: TournamentFormat,
  config: TournamentConfig,
): Promise<Tournament> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ venue_id: venueId, sport_id: sportId, name, format, status: 'setup', config })
    .select()
    .single()
  if (error) throw error
  return data as Tournament
}

export async function addParticipant(
  tournamentId: string,
  userId: string,
  seed?: number,
): Promise<TournamentParticipant[]> {
  let assignedSeed = seed
  if (assignedSeed === undefined) {
    const { count } = await supabase
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
    assignedSeed = (count ?? 0) + 1
  }

  const { error } = await supabase.from('tournament_participants').insert({
    tournament_id: tournamentId,
    user_id: userId,
    seed: assignedSeed,
    status: 'active',
  })
  if (error) throw error

  const { data } = await supabase
    .from('tournament_participants')
    .select('*, users(id, name)')
    .eq('tournament_id', tournamentId)
    .order('seed')

  return (data as unknown as TournamentParticipant[]) ?? []
}

export async function generateGroupStage(tournamentId: string): Promise<void> {
  const [{ data: tournament }, { data: participants }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
    supabase
      .from('tournament_participants')
      .select('*, users(id, name)')
      .eq('tournament_id', tournamentId)
      .order('seed'),
  ])
  if (!tournament) throw new Error('Tournament not found')
  if (!participants?.length) throw new Error('No participants added')

  const config = tournament.config as TournamentConfig
  const numGroups = Math.ceil(participants.length / config.playersPerGroup)
  const { venueId, sportId } = await getDefaultVenueAndSport()

  // Create group records (Group A, B, C, ...)
  const { data: groups, error: gErr } = await supabase
    .from('tournament_groups')
    .insert(
      Array.from({ length: numGroups }, (_, i) => ({
        tournament_id: tournamentId,
        name: `Group ${String.fromCharCode(65 + i)}`,
        group_type: 'group',
      }))
    )
    .select()
  if (gErr) throw gErr

  /**
   * Snake / serpentine seeding. For 3 groups:
   *   Round 1 (L→R): A, B, C  (seeds 1, 2, 3)
   *   Round 2 (R→L): C, B, A  (seeds 4, 5, 6)
   *   Round 3 (L→R): A, B, C  (seeds 7, 8, 9)
   * Ensures no group has all top seeds.
   */
  const groupParticipants = new Map<string, typeof participants[number][]>(
    groups!.map(g => [g.id, []])
  )

  for (let i = 0; i < participants.length; i++) {
    const round = Math.floor(i / numGroups)
    const posInRound = i % numGroups
    const groupIndex = round % 2 === 0 ? posInRound : numGroups - 1 - posInRound
    const groupId = groups![groupIndex].id
    groupParticipants.get(groupId)!.push(participants[i])
    await supabase
      .from('tournament_participants')
      .update({ group_id: groupId })
      .eq('id', participants[i].id)
  }

  // Create round-robin matches within each group (all pairs)
  for (const group of groups!) {
    const gParts = groupParticipants.get(group.id)!
    const matchInserts: object[] = []

    for (let a = 0; a < gParts.length; a++) {
      for (let b = a + 1; b < gParts.length; b++) {
        matchInserts.push({
          tournament_id: tournamentId,
          group_id: group.id,
          round: 1,
          position: matchInserts.length + 1,
          player_a_id: gParts[a].user_id,
          player_b_id: gParts[b].user_id,
          status: 'pending',
        })
      }
    }

    const { data: tMatches, error: tmErr } = await supabase
      .from('tournament_matches')
      .insert(matchInserts)
      .select()
    if (tmErr) throw tmErr

    // Create the underlying match records so scoring works immediately
    await Promise.all(
      (tMatches as TournamentMatch[]).map(async tm => {
        if (!tm.player_a_id || !tm.player_b_id) return
        const matchId = await createUnderlyingMatch(
          tm.player_a_id, tm.player_b_id, config, venueId, sportId
        )
        await supabase
          .from('tournament_matches')
          .update({ match_id: matchId })
          .eq('id', tm.id)
      })
    )
  }

  await supabase.from('tournaments').update({ status: 'group' }).eq('id', tournamentId)
}

/**
 * Called after all group-stage matches are complete.
 *
 * The Southfield format: after the group stage nobody is eliminated — everyone
 * continues in one of two parallel single-elimination brackets:
 *
 *   WINNERS bracket  — players who finished in the top `advanceFromGroup`
 *                       positions in their group.
 *   LOSERS  bracket  — everyone else.
 *
 * Both brackets run simultaneously. This keeps all players engaged for the
 * entire night; there is no "knocked out at group stage and go home" scenario.
 *
 * Seeding uses snake/serpentine ordering across groups, so the brackets are
 * competitive and no single group dominates one side of the draw:
 *
 *   Winners bracket seeds:
 *     pos-1 L→R: GrpA-1st(s1), GrpB-1st(s2), GrpC-1st(s3)
 *     pos-2 R→L: GrpC-2nd(s4), GrpB-2nd(s5), GrpA-2nd(s6)
 *
 *   Losers bracket seeds follow the same pattern for 3rd-place finishers, etc.
 *
 * Byes are assigned to the weakest seeds so stronger players get the free round.
 */
export async function generateParallelBrackets(tournamentId: string): Promise<void> {
  const [{ data: tournament }, { data: groups }] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
    supabase
      .from('tournament_groups')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('group_type', 'group'),
  ])
  if (!tournament) throw new Error('Tournament not found')
  if (!groups?.length) throw new Error('No group stage found')

  const config = tournament.config as TournamentConfig
  const { venueId, sportId } = await getDefaultVenueAndSport()

  // Rank players within each group
  const groupStandings = await Promise.all(groups.map(g => computeGroupStandings(g.id)))

  // Split into winners and losers pools (one array per group)
  const winnersPool: string[][] = groupStandings.map(s =>
    s.slice(0, config.advanceFromGroup).map(p => p.userId)
  )
  const losersPool: string[][] = groupStandings.map(s =>
    s.slice(config.advanceFromGroup).map(p => p.userId)
  )

  /**
   * Flatten a per-group pool into a single seeded array using snake ordering.
   * Iterates by finish position across all groups, reversing direction each row.
   */
  function snakeSeed(pool: string[][]): string[] {
    const maxPos = Math.max(...pool.map(g => g.length))
    const result: string[] = []
    for (let pos = 0; pos < maxPos; pos++) {
      const row = pool.map(g => g[pos]).filter((x): x is string => Boolean(x))
      if (pos % 2 === 1) row.reverse()
      result.push(...row)
    }
    return result
  }

  const winnerSeeds = snakeSeed(winnersPool)
  const loserSeeds  = snakeSeed(losersPool)

  // Create the two bracket groups
  const { data: bracketGroups, error: bgErr } = await supabase
    .from('tournament_groups')
    .insert([
      { tournament_id: tournamentId, name: 'Winners Bracket', group_type: 'winners' },
      { tournament_id: tournamentId, name: 'Losers Bracket',  group_type: 'losers'  },
    ])
    .select()
  if (bgErr) throw bgErr

  const winnersGroup = bracketGroups.find(g => g.group_type === 'winners')!
  const losersGroup  = bracketGroups.find(g => g.group_type === 'losers')!

  // Build and persist both bracket trees
  await Promise.all([
    insertAndWireBracket(
      winnersGroup.id, tournamentId, buildBracketMatches(winnerSeeds), config, venueId, sportId
    ),
    insertAndWireBracket(
      losersGroup.id,  tournamentId, buildBracketMatches(loserSeeds),  config, venueId, sportId
    ),
  ])

  // Point each participant to their bracket group
  const assignments = [
    ...winnerSeeds.map(uid => ({ uid, groupId: winnersGroup.id })),
    ...loserSeeds.map(uid =>  ({ uid, groupId: losersGroup.id  })),
  ]
  await Promise.all(
    assignments.map(({ uid, groupId }) =>
      supabase
        .from('tournament_participants')
        .update({ group_id: groupId })
        .eq('tournament_id', tournamentId)
        .eq('user_id', uid)
    )
  )

  await supabase.from('tournaments').update({ status: 'brackets' }).eq('id', tournamentId)
}

export async function advanceWinner(
  tournamentMatchId: string,
  winnerId: string,
): Promise<{ complete: boolean }> {
  const { data: tmRow, error: fetchErr } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('id', tournamentMatchId)
    .single()
  if (fetchErr) throw fetchErr

  const tm = tmRow as TournamentMatch
  const loserId = tm.player_a_id === winnerId ? tm.player_b_id : tm.player_a_id

  // 1. Mark this match done
  await supabase
    .from('tournament_matches')
    .update({ winner_id: winnerId, loser_id: loserId, status: 'complete' })
    .eq('id', tournamentMatchId)

  const { data: tRow } = await supabase.from('tournaments').select('*').eq('id', tm.tournament_id).single()
  const config = tRow?.config as TournamentConfig

  let complete = false

  // 2. Feed winner into the next match
  if (tm.next_match_id) {
    const isSlotA = tm.position % 2 === 1

    const { data: nextRow } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('id', tm.next_match_id)
      .single()
    const next = nextRow as TournamentMatch

    await supabase
      .from('tournament_matches')
      .update(isSlotA ? { player_a_id: winnerId } : { player_b_id: winnerId })
      .eq('id', tm.next_match_id)

    // Create the underlying match when both bracket slots are now filled
    const updatedA = isSlotA ? winnerId : next.player_a_id
    const updatedB = isSlotA ? next.player_b_id : winnerId

    if (updatedA && updatedB && !next.match_id) {
      const { venueId, sportId } = await getDefaultVenueAndSport()
      const matchId = await createUnderlyingMatch(updatedA, updatedB, config, venueId, sportId)
      await supabase
        .from('tournament_matches')
        .update({ match_id: matchId })
        .eq('id', tm.next_match_id)
    }
  } else {
    // No next match — check if the whole tournament is now done
    const { count } = await supabase
      .from('tournament_matches')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tm.tournament_id)
      .neq('status', 'complete')

    if ((count ?? 1) === 0) {
      await supabase
        .from('tournaments')
        .update({ status: 'complete' })
        .eq('id', tm.tournament_id)

      await supabase
        .from('tournament_participants')
        .update({ status: 'won' })
        .eq('tournament_id', tm.tournament_id)
        .eq('user_id', winnerId)

      complete = true
    }
  }

  // 3. Mark loser eliminated in bracket phase (not group stage)
  if (loserId) {
    const { data: group } = await supabase
      .from('tournament_groups')
      .select('group_type')
      .eq('id', tm.group_id ?? '')
      .single()

    if (group?.group_type !== 'group') {
      await supabase
        .from('tournament_participants')
        .update({ status: 'eliminated' })
        .eq('tournament_id', tm.tournament_id)
        .eq('user_id', loserId)
    }
  }

  return { complete }
}

export async function getTournamentState(tournamentId: string): Promise<TournamentState> {
  const [
    { data: tournament },
    { data: groups },
    { data: participants },
    { data: matches },
  ] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
    supabase.from('tournament_groups').select('*').eq('tournament_id', tournamentId),
    supabase
      .from('tournament_participants')
      .select('*, users(id, name)')
      .eq('tournament_id', tournamentId)
      .order('seed'),
    supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round')
      .order('position'),
  ])

  if (!tournament) throw new Error('Tournament not found')

  const allMatches = (matches ?? []) as TournamentMatch[]
  const pending = allMatches.filter(m => m.status !== 'complete')
  const currentRound = pending.length > 0
    ? Math.min(...pending.map(m => m.round))
    : Math.max(...allMatches.map(m => m.round), 1)

  return {
    tournament: tournament as Tournament,
    groups: (groups ?? []) as TournamentGroup[],
    participants: (participants as unknown as TournamentParticipant[]) ?? [],
    matches: allMatches,
    phase: (tournament as Tournament).status,
    currentRound,
  }
}

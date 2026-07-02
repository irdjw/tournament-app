import { supabase } from './supabase'

// ─── Public types ─────────────────────────────────────────────────────────────
// Format values match what Copilot UI pages render/check.

export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'group_stage'
export type TournamentStatus = 'setup' | 'active' | 'group' | 'brackets' | 'complete'
export type GroupType = 'group' | 'winners' | 'losers' | 'grand_final'

export interface TournamentConfig {
  legs: number
  startingScore: 301 | 501
  doubleOut: boolean
  /** Players per group (group_stage format). */
  groupSize: number
  /** How many places advance from each group to the parallel brackets. Default 2. */
  advanceFromGroup: number
}

export interface Player {
  id: string
  name: string
}

export interface GroupPreview {
  name: string
  players: Player[]
}

export interface Tournament {
  id: string
  name: string
  format: TournamentFormat
  status: TournamentStatus
  sport_id: string
  venue_id: string
  config: TournamentConfig
  created_at: string
}

export interface TournamentGroup {
  id: string
  tournament_id: string
  name: string
  group_type: GroupType | string
}

export interface TournamentParticipant {
  id: string
  tournament_id: string
  user_id: string
  seed: number
  group_id: string | null
  status: string
  users?: { id: string; name: string }
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
  // Joined by getTournamentFull — not present in raw DB rows
  player_a?: Player | null
  player_b?: Player | null
  winner?: Player | null
  group?: TournamentGroup | null
}

/** Intermediate structure for the pure bracket builder — no DB IDs yet. */
export interface BracketMatch {
  round: number
  position: number
  player_a_id: string | null
  player_b_id: string | null
}

export interface FullTournamentData {
  tournament: Tournament
  groups: TournamentGroup[]
  participants: TournamentParticipant[]
  matches: TournamentMatch[]
}

/** Extended state (superset of FullTournamentData). */
export interface TournamentState extends FullTournamentData {
  phase: TournamentStatus
  currentRound: number
}

// ─── Pure bracket utilities ───────────────────────────────────────────────────

/** Smallest power of 2 >= n. */
export function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/**
 * Seed numbers in bracket-slot order for a bracket of size `p` (power of 2).
 *
 * Guarantees seed 1 and seed 2 can only meet in the final:
 *   p=2 → [1,2]           → Final: 1v2
 *   p=4 → [1,4,2,3]       → SF: 1v4, 2v3 → Final: 1v2
 *   p=8 → [1,8,4,5,2,7,3,6] → QF: 1v8, 4v5, 2v7, 3v6 → ...
 *
 * Algorithm: recursive complement interleaving.
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
 * Full bracket match skeleton for a seeded single-elimination bracket.
 *
 * Byes go to the weakest seeds (slot = null when seed > n).
 * The winner of (round r, position p) advances to (round r+1, position ⌈p/2⌉),
 * filling slot A when p is odd, slot B when p is even.
 *
 * @param players Player IDs in seed order (index 0 = seed 1). Need not be
 *   a power-of-2 length — extra slots become byes.
 */
export function buildBracketMatches(players: (string | null)[]): BracketMatch[] {
  const n = players.length
  const p = nextPowerOf2(n)
  const seeds = bracketSeeds(p)
  const slots = seeds.map(seed => (seed <= n ? players[seed - 1] : null))
  const totalRounds = Math.log2(p)
  const matches: BracketMatch[] = []

  for (let pos = 1; pos <= p / 2; pos++) {
    matches.push({
      round: 1,
      position: pos,
      player_a_id: slots[(pos - 1) * 2],
      player_b_id: slots[(pos - 1) * 2 + 1],
    })
  }
  for (let round = 2; round <= totalRounds; round++) {
    const count = p / Math.pow(2, round)
    for (let pos = 1; pos <= count; pos++) {
      matches.push({ round, position: pos, player_a_id: null, player_b_id: null })
    }
  }
  return matches
}

/**
 * Pure group preview — used by the wizard UI before any DB writes.
 *
 * For `group_stage`: splits players into groups of `groupSize` using
 * snake/serpentine seeding so no group gets all top seeds.
 * For elimination formats: previews the bracket seeding as a single "group".
 */
export function previewGroups(
  players: Player[],
  format: TournamentFormat,
  groupSize: number,
): GroupPreview[] {
  if (format !== 'group_stage') {
    return [{ name: format === 'double_elimination' ? 'Winners Bracket' : 'Bracket', players }]
  }

  const numGroups = Math.ceil(players.length / groupSize)
  const groups: GroupPreview[] = Array.from({ length: numGroups }, (_, i) => ({
    name: `Group ${String.fromCharCode(65 + i)}`,
    players: [],
  }))

  // Snake seeding
  for (let i = 0; i < players.length; i++) {
    const round = Math.floor(i / numGroups)
    const posInRound = i % numGroups
    const groupIndex = round % 2 === 0 ? posInRound : numGroups - 1 - posInRound
    groups[groupIndex].players.push(players[i])
  }
  return groups.filter(g => g.players.length > 0)
}

/** Pure: matches that have both players known and are not yet complete. */
export function getActiveMatches(matches: TournamentMatch[]): TournamentMatch[] {
  return matches.filter(m => m.player_a_id && m.player_b_id && m.status !== 'complete')
}

// ─── DB helpers (private) ─────────────────────────────────────────────────────

async function getOrCreateSport(sport: string): Promise<string> {
  let { data } = await supabase.from('sports').select('id').eq('name', sport).single()
  if (data) return data.id
  const { data: created, error } = await supabase
    .from('sports').insert({ name: sport }).select('id').single()
  if (error) throw error
  return created.id
}

/** Venue and sport come from the tournament row itself — never guessed. */
function requireVenueAndSport(t: { venue_id: string | null; sport_id: string | null } | null): { venueId: string; sportId: string } {
  if (!t?.venue_id) throw new Error('Tournament has no venue — cannot create matches')
  if (!t?.sport_id) throw new Error('Tournament has no sport — cannot create matches')
  return { venueId: t.venue_id, sportId: t.sport_id }
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
      status: 'in_progress',
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
 * Inserts bracket matches for a group, wires next_match_id links, creates
 * underlying match records for known R1 pairs, and auto-advances byes.
 */
async function insertAndWireBracket(
  groupId: string,
  tournamentId: string,
  bracketMatches: BracketMatch[],
  config: TournamentConfig,
  venueId: string,
  sportId: string,
): Promise<TournamentMatch[]> {
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

  const idAt = (round: number, pos: number) =>
    inserted.find(r => r.round === round && r.position === pos)?.id ?? null

  // Wire next_match_id: (r, p) → (r+1, ⌈p/2⌉)
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

  // Create underlying matches for R1 pairs with two real players
  const round1Real = inserted.filter(r => r.round === 1 && r.player_a_id && r.player_b_id)
  await Promise.all(
    round1Real.map(async r => {
      const matchId = await createUnderlyingMatch(r.player_a_id!, r.player_b_id!, config, venueId, sportId)
      await supabase.from('tournament_matches').update({ match_id: matchId }).eq('id', r.id)
    })
  )

  // Auto-advance byes
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

  const { data: final } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('group_id', groupId)
    .order('round')
    .order('position')

  return (final as TournamentMatch[]) ?? inserted
}

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

export { getOrCreatePlayer as getOrCreateUser } from './players'

/**
 * Creates a tournament record for the given venue.
 * The venue comes from the signed-in staff member's venue_admins row.
 */
export async function createTournament(
  name: string,
  format: TournamentFormat,
  sport: string,
  config: Partial<TournamentConfig>,
  venueId: string,
): Promise<Tournament> {
  if (!venueId) throw new Error('No venue linked to your account — cannot create a tournament')
  const sportId = await getOrCreateSport(sport)

  const fullConfig: TournamentConfig = {
    legs: config.legs ?? 3,
    startingScore: config.startingScore ?? 501,
    doubleOut: config.doubleOut ?? true,
    groupSize: config.groupSize ?? 4,
    advanceFromGroup: config.advanceFromGroup ?? 2,
  }

  const { data, error } = await supabase
    .from('tournaments')
    .insert({ venue_id: venueId, sport_id: sportId, name, format, status: 'setup', config: fullConfig })
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

/**
 * Master setup function called by the wizard after createTournament.
 * Inserts participants and generates the initial match structure.
 */
export async function generateTournamentStructure(
  tournamentId: string,
  players: Player[],
  format: TournamentFormat,
  config: TournamentConfig,
): Promise<void> {
  const { data: t } = await supabase
    .from('tournaments')
    .select('sport_id, venue_id')
    .eq('id', tournamentId)
    .single()

  const { venueId, sportId } = requireVenueAndSport(t)

  // 1. Insert participants
  if (players.length > 0) {
    const { error: pErr } = await supabase.from('tournament_participants').insert(
      players.map((p, i) => ({
        tournament_id: tournamentId,
        user_id: p.id,
        seed: i + 1,
        status: 'active',
      }))
    )
    if (pErr) throw pErr
  }

  // 2. Build match structure
  if (format === 'group_stage') {
    await generateGroupStage(tournamentId)
  } else {
    const playerIds = players.map(p => p.id)
    if (format === 'single_elimination') {
      const { data: bracketGroup, error: bgErr } = await supabase
        .from('tournament_groups')
        .insert({ tournament_id: tournamentId, name: 'Bracket', group_type: 'winners' })
        .select()
        .single()
      if (bgErr) throw bgErr
      await insertAndWireBracket(bracketGroup.id, tournamentId, buildBracketMatches(playerIds), config, venueId, sportId)
    } else {
      // double_elimination: winners bracket contains all players; losers bracket
      // is seeded in reverse (worst seeds first) and populated as players lose
      const { data: bracketGroups, error: bgErr } = await supabase
        .from('tournament_groups')
        .insert([
          { tournament_id: tournamentId, name: 'Winners Bracket', group_type: 'winners' },
          { tournament_id: tournamentId, name: 'Losers Bracket', group_type: 'losers' },
        ])
        .select()
      if (bgErr) throw bgErr

      const winnersGroup = bracketGroups.find(g => g.group_type === 'winners')!
      await insertAndWireBracket(
        winnersGroup.id, tournamentId, buildBracketMatches(playerIds), config, venueId, sportId
      )
      // Losers bracket matches are created on-demand via recordTournamentMatchResult
    }
  }
}

/** Sets tournament status to 'active' — called after structure is generated. */
export async function startTournament(tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', tournamentId)
  if (error) throw error
}

/**
 * Generates the initial group-stage match structure.
 * Uses snake/serpentine seeding across groups so no group holds all top seeds.
 */
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
  const numGroups = Math.ceil(participants.length / config.groupSize)
  const { venueId, sportId } = requireVenueAndSport(tournament)

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

    await Promise.all(
      (tMatches as TournamentMatch[]).map(async tm => {
        if (!tm.player_a_id || !tm.player_b_id) return
        const matchId = await createUnderlyingMatch(
          tm.player_a_id, tm.player_b_id, config, venueId, sportId
        )
        await supabase.from('tournament_matches').update({ match_id: matchId }).eq('id', tm.id)
      })
    )
  }

  await supabase.from('tournaments').update({ status: 'active' }).eq('id', tournamentId)
}

/**
 * The Southfield format: after group stage, nobody is eliminated.
 * Players finishing in the top `advanceFrom` positions go to the Winners Bracket;
 * everyone else goes to the Losers Bracket. Both brackets run in parallel.
 *
 * Snake/serpentine seeding within each bracket pool ensures competitive balance —
 * no single group dominates one side of the draw.
 */
export async function generateParallelBrackets(tournamentId: string): Promise<void> {
  await generateKnockoutFromGroups(tournamentId, undefined)
}

/**
 * Generates knockout bracket(s) from completed group stage results.
 *
 * When `advanceFrom` is defined: top N players per group → Winners Bracket,
 * everyone else → Losers Bracket (the Southfield parallel-elim format).
 *
 * When `advanceFrom` is undefined, defaults to `config.advanceFromGroup` (2).
 */
export async function generateKnockoutFromGroups(
  tournamentId: string,
  advanceFrom?: number,
): Promise<void> {
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
  const advance = advanceFrom ?? config.advanceFromGroup ?? 2
  const { venueId, sportId } = requireVenueAndSport(tournament)

  const groupStandings = await Promise.all(groups.map(g => computeGroupStandings(g.id)))

  const winnersPool: string[][] = groupStandings.map(s =>
    s.slice(0, advance).map(p => p.userId)
  )
  const losersPool: string[][] = groupStandings.map(s =>
    s.slice(advance).map(p => p.userId)
  )

  /** Snake-flatten a per-group pool into a seeded array. */
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
  const hasLosers   = loserSeeds.length > 0

  const groupsToCreate = [
    { tournament_id: tournamentId, name: 'Winners Bracket', group_type: 'winners' },
    ...(hasLosers ? [{ tournament_id: tournamentId, name: 'Losers Bracket', group_type: 'losers' }] : []),
  ]

  const { data: bracketGroups, error: bgErr } = await supabase
    .from('tournament_groups')
    .insert(groupsToCreate)
    .select()
  if (bgErr) throw bgErr

  const winnersGroup = bracketGroups.find(g => g.group_type === 'winners')!
  const losersGroup  = bracketGroups.find(g => g.group_type === 'losers')

  const tasks = [
    insertAndWireBracket(
      winnersGroup.id, tournamentId, buildBracketMatches(winnerSeeds), config, venueId, sportId
    ),
  ]
  if (losersGroup && loserSeeds.length > 0) {
    tasks.push(
      insertAndWireBracket(
        losersGroup.id, tournamentId, buildBracketMatches(loserSeeds), config, venueId, sportId
      )
    )
  }
  await Promise.all(tasks)

  // Reassign participants to their bracket groups
  const assignments = [
    ...winnerSeeds.map(uid => ({ uid, groupId: winnersGroup.id })),
    ...(losersGroup ? loserSeeds.map(uid => ({ uid, groupId: losersGroup.id })) : []),
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

/**
 * Creates an underlying match record for a tournament bracket slot and marks
 * the slot as in_progress.
 */
export async function createMatchForTournamentSlot(
  tournamentMatchId: string,
  sportId: string,
  venueId: string,
  config: TournamentConfig,
  playerAId: string,
  playerBId: string,
): Promise<string> {
  const matchId = await createUnderlyingMatch(playerAId, playerBId, config, venueId, sportId)
  await supabase
    .from('tournament_matches')
    .update({ match_id: matchId, status: 'in_progress' })
    .eq('id', tournamentMatchId)
  return matchId
}

/**
 * Records a tournament match result, advances the winner to the next bracket
 * slot, creates the underlying match when both bracket slots are filled,
 * and marks the tournament complete if no matches remain.
 */
export async function recordTournamentMatchResult(
  tournamentMatchId: string,
  winnerId: string,
  loserId: string,
): Promise<void> {
  await advanceWinner(tournamentMatchId, winnerId)
}

/**
 * Winner of the tournament: the winner of the grand final if one exists,
 * otherwise the winner of the winners-bracket final. Returns null when no
 * bracket final has completed (e.g. group-only formats).
 */
async function findChampion(tournamentId: string): Promise<string | null> {
  const { data } = await supabase
    .from('tournament_matches')
    .select('winner_id, group:group_id(group_type)')
    .eq('tournament_id', tournamentId)
    .is('next_match_id', null)
    .eq('status', 'complete')

  const rows = (data ?? []) as {
    winner_id: string | null
    group: { group_type: string } | { group_type: string }[] | null
  }[]
  const groupType = (r: typeof rows[number]) =>
    Array.isArray(r.group) ? r.group[0]?.group_type : r.group?.group_type

  const grandFinal = rows.find(r => groupType(r) === 'grand_final')
  if (grandFinal?.winner_id) return grandFinal.winner_id
  return rows.find(r => groupType(r) === 'winners')?.winner_id ?? null
}

/**
 * Core bracket-advancement function.
 * Records winner/loser, fills the winner's next-round slot (A if odd position,
 * B if even), creates an underlying match when both slots of that round are
 * filled, marks losers eliminated (in bracket phase), and detects
 * tournament completion.
 *
 * Idempotent: recording a result on an already-complete slot is a no-op, and
 * the complete-claim is guarded so two concurrent clients (e.g. two open
 * control pages reacting to the same realtime event) cannot double-advance.
 */
export async function advanceWinner(
  tournamentMatchId: string,
  winnerId: string,
): Promise<{ complete: boolean }> {
  const { data: tmRow, error: fetchErr } = await supabase
    .from('tournament_matches')
    .select('*, group:group_id(id, name, group_type)')
    .eq('id', tournamentMatchId)
    .single()
  if (fetchErr) throw fetchErr

  const tm = tmRow as TournamentMatch
  if (tm.status === 'complete') return { complete: false }

  const loserId = tm.player_a_id === winnerId ? tm.player_b_id : tm.player_a_id
  const isGroupStageMatch = tm.group?.group_type === 'group'

  // Claim the result — only one client can transition the slot to complete.
  const { data: claimed, error: claimErr } = await supabase
    .from('tournament_matches')
    .update({ winner_id: winnerId, loser_id: loserId, status: 'complete' })
    .eq('id', tournamentMatchId)
    .neq('status', 'complete')
    .select('id')
  if (claimErr) throw claimErr
  if (!claimed?.length) return { complete: false } // another client got there first

  const { data: tRow } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tm.tournament_id)
    .single()
  const config = tRow?.config as TournamentConfig

  let complete = false

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

    const updatedA = isSlotA ? winnerId : next.player_a_id
    const updatedB = isSlotA ? next.player_b_id : winnerId

    if (updatedA && updatedB && !next.match_id) {
      const { venueId, sportId } = requireVenueAndSport(tRow)
      const matchId = await createUnderlyingMatch(updatedA, updatedB, config, venueId, sportId)
      await supabase
        .from('tournament_matches')
        .update({ match_id: matchId, status: 'in_progress' })
        .eq('id', tm.next_match_id)
    }
  } else if (!isGroupStageMatch) {
    // A bracket final completed. The tournament is done when nothing is left
    // to play. (Group-stage matches never complete the tournament — the
    // knockout stage still has to be generated.)
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

      // Champion = winner of the grand final / winners-bracket final — NOT
      // whichever match happened to finish last (the losers final can finish
      // after the winners final).
      const championId = (await findChampion(tm.tournament_id)) ?? winnerId
      await supabase
        .from('tournament_participants')
        .update({ status: 'won' })
        .eq('tournament_id', tm.tournament_id)
        .eq('user_id', championId)
      complete = true
    }
  }

  if (loserId && !isGroupStageMatch) {
    await supabase
      .from('tournament_participants')
      .update({ status: 'eliminated' })
      .eq('tournament_id', tm.tournament_id)
      .eq('user_id', loserId)
  }

  return { complete }
}

/**
 * Returns the full tournament state with all groups, participants, and matches,
 * where matches include joined player_a, player_b, winner and group data so
 * UI components can read match.player_a.name etc. without extra queries.
 */
export async function getTournamentFull(tournamentId: string): Promise<FullTournamentData> {
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
      .select(`
        *,
        player_a:player_a_id(id, name),
        player_b:player_b_id(id, name),
        winner:winner_id(id, name),
        group:group_id(id, name, group_type)
      `)
      .eq('tournament_id', tournamentId)
      .order('round')
      .order('position'),
  ])

  if (!tournament) throw new Error('Tournament not found')

  return {
    tournament: tournament as Tournament,
    groups: (groups ?? []) as TournamentGroup[],
    participants: (participants as unknown as TournamentParticipant[]) ?? [],
    matches: (matches as unknown as TournamentMatch[]) ?? [],
  }
}

/** Extended state — superset of FullTournamentData with phase and current round. */
export async function getTournamentState(tournamentId: string): Promise<TournamentState> {
  const full = await getTournamentFull(tournamentId)
  const pending = full.matches.filter(m => m.status !== 'complete')
  const currentRound = pending.length > 0
    ? Math.min(...pending.map(m => m.round))
    : Math.max(...full.matches.map(m => m.round), 1)

  return {
    ...full,
    phase: full.tournament.status,
    currentRound,
  }
}

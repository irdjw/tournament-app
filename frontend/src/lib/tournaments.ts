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

/**
 * Builds the full double-elimination structure: Winners Bracket, Losers Bracket,
 * and a Grand Final match. Wires next_match_id within each bracket and sets
 * loser_next_match_id on every WB match so losers drop into the correct LB slot.
 *
 * LB round layout (2*(k-1) rounds for 2^k players):
 *   Odd rounds  (consolidation) — LB survivors play each other
 *   Even rounds (drop-in)       — fresh WB losers enter against LB survivors
 */
async function buildDoubleElimination(
  tournamentId: string,
  players: Player[],
  config: TournamentConfig,
  venueId: string,
  sportId: string,
): Promise<void> {
  const p = nextPowerOf2(players.length)
  const k = Math.log2(p)
  const playerIds = players.map(pl => pl.id)

  if (k < 2) {
    const { data: g, error: gErr } = await supabase
      .from('tournament_groups')
      .insert({ tournament_id: tournamentId, name: 'Winners Bracket', group_type: 'winners' })
      .select().single()
    if (gErr) throw gErr
    await insertAndWireBracket(g.id, tournamentId, buildBracketMatches(playerIds), config, venueId, sportId)
    return
  }

  const { data: groups, error: gErr } = await supabase
    .from('tournament_groups')
    .insert([
      { tournament_id: tournamentId, name: 'Winners Bracket', group_type: 'winners' },
      { tournament_id: tournamentId, name: 'Losers Bracket', group_type: 'losers' },
      { tournament_id: tournamentId, name: 'Grand Final', group_type: 'grand_final' },
    ])
    .select()
  if (gErr) throw gErr

  const wbGroup = (groups as any[]).find(g => g.group_type === 'winners')!
  const lbGroup = (groups as any[]).find(g => g.group_type === 'losers')!
  const gfGroup = (groups as any[]).find(g => g.group_type === 'grand_final')!

  const wbMatches = await insertAndWireBracket(
    wbGroup.id, tournamentId, buildBracketMatches(playerIds), config, venueId, sportId
  )

  // Build LB match shells
  // LR1, LR2: p/4 matches; LR3, LR4: p/8 matches; … LR(2k-3), LR(2k-2): 1 match
  const lbRounds = 2 * (k - 1)
  const lbMatchInserts: { round: number; position: number }[] = []
  for (let lbRound = 1; lbRound <= lbRounds; lbRound++) {
    const rc = Math.ceil(lbRound / 2)
    const count = p / Math.pow(2, rc + 1)
    for (let pos = 1; pos <= count; pos++) {
      lbMatchInserts.push({ round: lbRound, position: pos })
    }
  }

  const { data: lbRows, error: lbErr } = await supabase
    .from('tournament_matches')
    .insert(
      lbMatchInserts.map(m => ({
        group_id: lbGroup.id,
        tournament_id: tournamentId,
        round: m.round,
        position: m.position,
        player_a_id: null,
        player_b_id: null,
        status: 'pending',
      }))
    )
    .select()
  if (lbErr) throw lbErr

  const lbMatches = lbRows as TournamentMatch[]
  const lbAt = (round: number, pos: number) =>
    lbMatches.find(m => m.round === round && m.position === pos)

  // Wire next_match_id within LB
  // Consolidation (odd) → next round same position (1-to-1)
  // Drop-in (even) → next round ceil(pos/2) (2-to-1 pairing)
  await Promise.all(
    lbMatches
      .filter(m => m.round < lbRounds)
      .map(m => {
        const nextPos = m.round % 2 === 1 ? m.position : Math.ceil(m.position / 2)
        const nextMatch = lbAt(m.round + 1, nextPos)
        if (!nextMatch) return Promise.resolve()
        return supabase
          .from('tournament_matches')
          .update({ next_match_id: nextMatch.id })
          .eq('id', m.id)
          .then(({ error: e }) => { if (e) throw e })
      })
  )

  // Create Grand Final match shell
  const { data: gfRow, error: gfErr } = await supabase
    .from('tournament_matches')
    .insert({
      group_id: gfGroup.id,
      tournament_id: tournamentId,
      round: 1,
      position: 1,
      player_a_id: null,
      player_b_id: null,
      status: 'pending',
    })
    .select()
    .single()
  if (gfErr) throw gfErr
  const gfMatchId = (gfRow as TournamentMatch).id

  // Wire LB final and WB final → Grand Final
  const lbFinal = lbAt(lbRounds, 1)
  if (lbFinal) {
    await supabase.from('tournament_matches').update({ next_match_id: gfMatchId }).eq('id', lbFinal.id)
  }
  const wbFinal = wbMatches.find(m => !m.next_match_id)
  if (wbFinal) {
    await supabase.from('tournament_matches').update({ next_match_id: gfMatchId }).eq('id', wbFinal.id)
  }

  // Wire loser_next_match_id: WB round-r losers → LB drop-in rounds
  // WR1 losers → LR1 (consolidation):  WR1Pi → LR1P(ceil(i/2))
  // WRr (r≥2) losers → LR(2r-2) (drop-in): WRrPi → LR(2r-2)Pi
  await Promise.all(
    wbMatches.map(m => {
      const targetLbRound = m.round === 1 ? 1 : 2 * (m.round - 1)
      const targetLbPos   = m.round === 1 ? Math.ceil(m.position / 2) : m.position
      const lbMatch = lbAt(targetLbRound, targetLbPos)
      if (!lbMatch) return Promise.resolve()
      return supabase
        .from('tournament_matches')
        .update({ loser_next_match_id: lbMatch.id })
        .eq('id', m.id)
        .then(({ error: e }) => { if (e) throw e })
    })
  )
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

/**
 * Creates a tournament record.
 * Auto-resolves venueId and sportId from the database.
 */
/**
 * Bulk-creates tournament shells for a recurring night. Format is left null —
 * the venue picks it on the night once they know how many players turned up.
 * Each record gets a `scheduled_for` date; if multiple dates, the day is
 * appended to the name automatically.
 */
export async function scheduleTournaments(
  baseName: string,
  sport: string,
  config: Partial<TournamentConfig>,
  dates: string[],
): Promise<void> {
  const venueId = await getOrCreateDefaultVenue()
  const sportId = await getOrCreateSport(sport)

  const fullConfig: TournamentConfig = {
    legs: config.legs ?? 3,
    startingScore: config.startingScore ?? 501,
    doubleOut: config.doubleOut ?? true,
    groupSize: config.groupSize ?? 4,
    advanceFromGroup: config.advanceFromGroup ?? 2,
  }

  const inserts = dates.map(date => ({
    venue_id: venueId,
    sport_id: sportId,
    name: dates.length > 1
      ? `${baseName} – ${new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : baseName,
    format: null,
    status: 'setup',
    config: fullConfig,
    scheduled_for: date,
  }))

  const { error } = await supabase.from('tournaments').insert(inserts)
  if (error) throw error
}

/** Updates format and config on an existing scheduled tournament before launch. */
export async function updateTournamentFormatAndConfig(
  tournamentId: string,
  format: TournamentFormat,
  config: TournamentConfig,
): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ format, config })
    .eq('id', tournamentId)
  if (error) throw error
}

export async function createTournament(
  name: string,
  format: TournamentFormat,
  sport: string,
  config: Partial<TournamentConfig>,
): Promise<Tournament> {
  const venueId = await getOrCreateDefaultVenue()
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

  const venueId = t?.venue_id ?? await getOrCreateDefaultVenue()
  const sportId = t?.sport_id ?? (await getOrCreateSport('darts'))

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
        await buildDoubleElimination(tournamentId, players, config, venueId, sportId)
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
  const { venueId, sportId } = await getDefaultVenueAndSport()

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
  const { venueId, sportId } = await getDefaultVenueAndSport()

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
 * Core bracket-advancement function.
 *
 * Records winner/loser, then:
 *  - Routes winner to next_match_id slot. Uses position-based slot (odd→A, even→B)
 *    for winners-bracket advancement; "fill first empty slot" for losers-bracket
 *    and grand-final targets so order of arrival doesn't matter.
 *  - Routes loser to loser_next_match_id (double elimination LB drop-in), using
 *    "fill first empty slot". If no LB route, marks loser eliminated.
 *  - Creates the underlying match record when both slots of a bracket slot are filled.
 *  - Detects tournament completion. For parallel-bracket (group_stage) formats the
 *    winners-bracket champion is the overall winner, not whoever won the last match.
 */
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

  await supabase
    .from('tournament_matches')
    .update({ winner_id: winnerId, loser_id: loserId, status: 'complete' })
    .eq('id', tournamentMatchId)

  const { data: tRow } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tm.tournament_id)
    .single()
  const config = tRow?.config as TournamentConfig

  let complete = false

  if (tm.next_match_id) {
    const { data: nextRow } = await supabase
      .from('tournament_matches')
      .select('*, group:group_id(id, name, group_type)')
      .eq('id', tm.next_match_id)
      .single()
    const next = nextRow as TournamentMatch
    const nextGroupType = (nextRow as any).group?.group_type as string | undefined

    // Losers bracket and grand final: fill the first empty slot so arrival order
    // doesn't matter (WB loser and LB survivor can arrive in either order).
    // Winners bracket: use position to preserve seeding structure.
    const isSlotA = (nextGroupType === 'losers' || nextGroupType === 'grand_final')
      ? !next.player_a_id
      : tm.position % 2 === 1

    await supabase
      .from('tournament_matches')
      .update(isSlotA ? { player_a_id: winnerId } : { player_b_id: winnerId })
      .eq('id', tm.next_match_id)

    const updatedA = isSlotA ? winnerId : next.player_a_id
    const updatedB = isSlotA ? next.player_b_id : winnerId

    if (updatedA && updatedB && !next.match_id) {
      const { venueId, sportId } = await getDefaultVenueAndSport()
      const matchId = await createUnderlyingMatch(updatedA, updatedB, config, venueId, sportId)
      await supabase
        .from('tournament_matches')
        .update({ match_id: matchId, status: 'in_progress' })
        .eq('id', tm.next_match_id)
    }
  } else {
    const { count } = await supabase
      .from('tournament_matches')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tm.tournament_id)
      .neq('status', 'complete')

    if ((count ?? 1) === 0) {
      // In parallel-bracket (group_stage) format the losers bracket may complete last,
      // but the winners bracket champion is always the tournament winner.
      let championId = winnerId
      const { data: matchGroup } = await supabase
        .from('tournament_groups')
        .select('group_type')
        .eq('id', tm.group_id ?? '')
        .single()
      if (matchGroup?.group_type === 'losers') {
        const { data: wGroups } = await supabase
          .from('tournament_groups')
          .select('id')
          .eq('tournament_id', tm.tournament_id)
          .eq('group_type', 'winners')
        const wgIds = ((wGroups ?? []) as any[]).map(g => g.id)
        if (wgIds.length > 0) {
          const { data: wFinal } = await supabase
            .from('tournament_matches')
            .select('winner_id')
            .in('group_id', wgIds)
            .is('next_match_id', null)
            .not('winner_id', 'is', null)
            .maybeSingle()
          if (wFinal?.winner_id) championId = wFinal.winner_id
        }
      }

      await supabase
        .from('tournaments')
        .update({ status: 'complete' })
        .eq('id', tm.tournament_id)
      await supabase
        .from('tournament_participants')
        .update({ status: 'won' })
        .eq('tournament_id', tm.tournament_id)
        .eq('user_id', championId)
      complete = true
    }
  }

  // Route loser to losers bracket (double elimination) or mark eliminated
  if (loserId && tm.loser_next_match_id) {
    const { data: lbRow } = await supabase
      .from('tournament_matches')
      .select('player_a_id, player_b_id, match_id')
      .eq('id', tm.loser_next_match_id)
      .single()

    if (lbRow) {
      const lbMatch = lbRow as { player_a_id: string | null; player_b_id: string | null; match_id: string | null }
      const goToSlotA = !lbMatch.player_a_id

      await supabase
        .from('tournament_matches')
        .update(goToSlotA ? { player_a_id: loserId } : { player_b_id: loserId })
        .eq('id', tm.loser_next_match_id)

      const updatedA = goToSlotA ? loserId : lbMatch.player_a_id
      const updatedB = goToSlotA ? lbMatch.player_b_id : loserId

      if (updatedA && updatedB && !lbMatch.match_id) {
        const { venueId, sportId } = await getDefaultVenueAndSport()
        const matchId = await createUnderlyingMatch(updatedA, updatedB, config, venueId, sportId)
        await supabase
          .from('tournament_matches')
          .update({ match_id: matchId, status: 'in_progress' })
          .eq('id', tm.loser_next_match_id)
      }
    }
  } else if (loserId) {
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

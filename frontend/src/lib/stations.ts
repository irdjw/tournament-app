import { supabase } from './supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

export type StationStatus = 'available' | 'in_use' | 'reserved'

export interface StationPlayer {
  id: string
  user_id: string
  team_id: 'team_a' | 'team_b'
  legs_won: number
  users: { id: string; name: string }
}

export interface StationMatch {
  id: string
  status: string
  legs_to_win: number
  current_leg: number
  match_players: StationPlayer[]
}

export interface Station {
  id: string
  venue_id: string
  name: string
  sport_id: string
  status: StationStatus
  current_match_id: string | null
  created_at: string
  sport: { id: string; name: string } | null
  current_match: StationMatch | null
}

export interface UnassignedMatch {
  id: string
  status: string
  match_players: Array<{ users: { name: string } }>
}

// ─── Queries ─────────────────────────────────────────────────────────────────

const STATION_FIELDS = `
  id, venue_id, name, sport_id, status, current_match_id, created_at,
  sport:sport_id(id, name),
  current_match:current_match_id(
    id, status, legs_to_win, current_leg,
    match_players(id, user_id, team_id, legs_won, users(id, name))
  )
`

export async function getStationsForVenue(venueId: string): Promise<Station[]> {
  const { data, error } = await supabase
    .from('stations')
    .select(STATION_FIELDS)
    .eq('venue_id', venueId)
    .order('name')
  if (error) throw error
  return (data as unknown as Station[]) ?? []
}

export async function getAllStations(): Promise<Station[]> {
  const { data, error } = await supabase
    .from('stations')
    .select(STATION_FIELDS)
    .order('name')
  if (error) throw error
  return (data as unknown as Station[]) ?? []
}

export async function assignMatchToStation(matchId: string, stationId: string): Promise<void> {
  const { error } = await supabase
    .from('stations')
    .update({ status: 'in_use', current_match_id: matchId })
    .eq('id', stationId)
  if (error) throw error
}

export async function clearStation(stationId: string): Promise<void> {
  const { error } = await supabase
    .from('stations')
    .update({ status: 'available', current_match_id: null })
    .eq('id', stationId)
  if (error) throw error
}

export async function clearStationByMatchId(matchId: string): Promise<void> {
  const { error } = await supabase
    .from('stations')
    .update({ status: 'available', current_match_id: null })
    .eq('current_match_id', matchId)
  if (error) throw error
}

export async function createStation(venueId: string, sportId: string, name: string): Promise<Station> {
  const { data, error } = await supabase
    .from('stations')
    .insert({ venue_id: venueId, sport_id: sportId, name, status: 'available' })
    .select(STATION_FIELDS)
    .single()
  if (error) throw error
  return data as unknown as Station
}

export async function getUnassignedMatches(): Promise<UnassignedMatch[]> {
  const { data: occupied } = await supabase
    .from('stations')
    .select('current_match_id')
    .not('current_match_id', 'is', null)

  const occupiedIds = (occupied ?? []).map((s: { current_match_id: string }) => s.current_match_id)

  let query = supabase
    .from('matches')
    .select('id, status, match_players(users(name))')
    .in('status', ['pending', 'in_progress'])

  if (occupiedIds.length > 0) {
    query = query.not('id', 'in', `(${occupiedIds.join(',')})`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data as unknown as UnassignedMatch[]) ?? []
}

// ─── Scores ──────────────────────────────────────────────────────────────────

export async function getScoresForMatch(
  matchId: string,
  currentLeg: number,
  players: StationPlayer[],
): Promise<Record<string, number>> {
  const scores: Record<string, number> = {}
  players.forEach(p => { scores[p.user_id] = 501 })

  const { data } = await supabase
    .from('match_events')
    .select('user_id, remaining_score')
    .eq('match_id', matchId)
    .eq('leg_number', currentLeg)
    .order('created_at', { ascending: false })

  const seen = new Set<string>()
  for (const event of data ?? []) {
    if (!seen.has(event.user_id)) {
      seen.add(event.user_id)
      scores[event.user_id] = event.remaining_score ?? 501
    }
  }
  return scores
}

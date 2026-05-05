import { supabase } from './supabase'

// ─── Venue / Sport helpers ───────────────────────────────────────────────────

async function getOrCreateDefaultVenue() {
  let { data } = await supabase.from('venues').select('id').limit(1).single()
  if (data) return data.id

  const { data: created, error } = await supabase
    .from('venues')
    .insert({ name: 'Default Venue' })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}

async function getOrCreateDartsSport() {
  let { data } = await supabase.from('sports').select('id').eq('name', 'darts').single()
  if (data) return data.id

  const { data: created, error } = await supabase
    .from('sports')
    .insert({ name: 'darts' })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}

export async function getOrCreateUser(name) {
  const email = `${name.toLowerCase().replace(/\s+/g, '')}@temp.com`
  const { data, error } = await supabase
    .from('users')
    .upsert({ name, email }, { onConflict: 'email' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

export async function createFixture(name, dayOfWeek, startTime) {
  const venueId = await getOrCreateDefaultVenue()
  const sportId = await getOrCreateDartsSport()

  const { data, error } = await supabase
    .from('fixtures')
    .insert({ venue_id: venueId, sport_id: sportId, name, day_of_week: dayOfWeek, start_time: startTime, active: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getFixture(fixtureId) {
  const { data, error } = await supabase
    .from('fixtures')
    .select('*')
    .eq('id', fixtureId)
    .single()
  if (error) throw error
  return data
}

// ─── Rounds ──────────────────────────────────────────────────────────────────

export async function createFixtureRound(fixtureId, roundNumber, playedOn) {
  const { data, error } = await supabase
    .from('fixture_rounds')
    .insert({ fixture_id: fixtureId, round_number: roundNumber, played_on: playedOn, status: 'in_progress' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getFixtureRound(roundId) {
  const { data, error } = await supabase
    .from('fixture_rounds')
    .select('*, fixture:fixture_id(*)')
    .eq('id', roundId)
    .single()
  if (error) throw error
  return data
}

export async function getNextRoundNumber(fixtureId) {
  const { data } = await supabase
    .from('fixture_rounds')
    .select('round_number')
    .eq('fixture_id', fixtureId)
    .order('round_number', { ascending: false })
    .limit(1)
    .single()
  return data ? data.round_number + 1 : 1
}

export async function completeRound(roundId) {
  const { error } = await supabase
    .from('fixture_rounds')
    .update({ status: 'complete' })
    .eq('id', roundId)
  if (error) throw error
}

// ─── Pairings ─────────────────────────────────────────────────────────────────

export async function getPairingsForRound(roundId) {
  const { data, error } = await supabase
    .from('fixture_pairings')
    .select(`
      id,
      station,
      match_id,
      home_player_id,
      away_player_id,
      home_player:home_player_id(id, name),
      away_player:away_player_id(id, name),
      match:match_id(id, status)
    `)
    .eq('fixture_round_id', roundId)
  if (error) throw error
  return data || []
}

export async function createPairing(fixtureRoundId, homePlayerName, awayPlayerName, station, legsToWin) {
  const [homePlayer, awayPlayer, venueId, sportId] = await Promise.all([
    getOrCreateUser(homePlayerName),
    getOrCreateUser(awayPlayerName),
    getOrCreateDefaultVenue(),
    getOrCreateDartsSport(),
  ])

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({
      venue_id: venueId,
      sport_id: sportId,
      match_type: 'league',
      status: 'pending',
      legs_to_win: legsToWin,
      current_leg: 1,
    })
    .select()
    .single()
  if (matchError) throw matchError

  const { error: playersError } = await supabase.from('match_players').insert([
    { match_id: match.id, user_id: homePlayer.id, team_id: 'team_a', legs_won: 0 },
    { match_id: match.id, user_id: awayPlayer.id, team_id: 'team_b', legs_won: 0 },
  ])
  if (playersError) throw playersError

  const { data: pairing, error: pairingError } = await supabase
    .from('fixture_pairings')
    .insert({
      fixture_round_id: fixtureRoundId,
      match_id: match.id,
      home_player_id: homePlayer.id,
      away_player_id: awayPlayer.id,
      station: station || null,
    })
    .select()
    .single()
  if (pairingError) throw pairingError

  return { pairing, match, homePlayer, awayPlayer }
}

// ─── Standings ───────────────────────────────────────────────────────────────

export async function getStandings(fixtureId) {
  const { data, error } = await supabase
    .from('standings')
    .select(`
      id,
      played,
      wins,
      losses,
      legs_for,
      legs_against,
      points,
      user:user_id(id, name)
    `)
    .eq('fixture_id', fixtureId)
  if (error) throw error

  return (data || []).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const diff = (b.legs_for - b.legs_against) - (a.legs_for - a.legs_against)
    if (diff !== 0) return diff
    return b.legs_for - a.legs_for
  })
}

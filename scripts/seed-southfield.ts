/**
 * Seed script: creates The Southfield venue with stations, sports, a darts
 * league fixture, and 8 dummy players with some existing standings.
 *
 * Usage:
 *   VITE_SUPABASE_URL=https://xxx.supabase.co \
 *   VITE_SUPABASE_ANON_KEY=eyJ... \
 *   npx ts-node --esm scripts/seed-southfield.ts
 *
 * Or copy the env values into a local .env and load with dotenv:
 *   node -r dotenv/config -e "require('./scripts/seed-southfield.ts')"
 *
 * The script is idempotent: re-running it will skip resources that already
 * exist (checked by name / email).
 */

import { createClient } from '@supabase/supabase-js'

// ─── Supabase client ──────────────────────────────────────────────────────────

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '❌  Missing env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or service role key).',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertVenue(name: string): Promise<string> {
  const { data: existing } = await supabase
    .from('venues')
    .select('id')
    .eq('name', name)
    .maybeSingle()
  if (existing) {
    console.log(`  venue "${name}" already exists → ${existing.id}`)
    return existing.id
  }
  const { data, error } = await supabase
    .from('venues')
    .insert({ name })
    .select('id')
    .single()
  if (error) throw error
  console.log(`  created venue "${name}" → ${data.id}`)
  return data.id
}

async function upsertSport(name: string): Promise<string> {
  const { data: existing } = await supabase
    .from('sports')
    .select('id')
    .eq('name', name)
    .maybeSingle()
  if (existing) {
    console.log(`  sport "${name}" already exists → ${existing.id}`)
    return existing.id
  }
  const { data, error } = await supabase
    .from('sports')
    .insert({ name })
    .select('id')
    .single()
  if (error) throw error
  console.log(`  created sport "${name}" → ${data.id}`)
  return data.id
}

async function upsertStation(
  venueId: string,
  sportId: string,
  name: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('stations')
    .select('id')
    .eq('venue_id', venueId)
    .eq('name', name)
    .maybeSingle()
  if (existing) {
    console.log(`  station "${name}" already exists → ${existing.id}`)
    return existing.id
  }
  const { data, error } = await supabase
    .from('stations')
    .insert({ venue_id: venueId, sport_id: sportId, name, status: 'available' })
    .select('id')
    .single()
  if (error) throw error
  console.log(`  created station "${name}" → ${data.id}`)
  return data.id
}

async function upsertUser(name: string): Promise<string> {
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@southfield.demo`
  const { data, error } = await supabase
    .from('users')
    .upsert({ name, email }, { onConflict: 'email' })
    .select('id')
    .single()
  if (error) throw error
  console.log(`  upserted user "${name}" → ${data.id}`)
  return data.id
}

async function upsertFixture(
  venueId: string,
  sportId: string,
  name: string,
  dayOfWeek: number,
  startTime: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('fixtures')
    .select('id')
    .eq('venue_id', venueId)
    .eq('name', name)
    .maybeSingle()
  if (existing) {
    console.log(`  fixture "${name}" already exists → ${existing.id}`)
    return existing.id
  }
  const { data, error } = await supabase
    .from('fixtures')
    .insert({
      venue_id: venueId,
      sport_id: sportId,
      name,
      day_of_week: dayOfWeek,
      start_time: startTime,
      active: true,
    })
    .select('id')
    .single()
  if (error) throw error
  console.log(`  created fixture "${name}" → ${data.id}`)
  return data.id
}

async function upsertStanding(
  fixtureId: string,
  userId: string,
  played: number,
  won: number,
  lost: number,
  legsFor: number,
  legsAgainst: number,
): Promise<void> {
  const points = won * 2  // 2pts for win, 0 for loss (no draws in darts)
  const { error } = await supabase
    .from('standings')
    .upsert(
      {
        fixture_id: fixtureId,
        user_id: userId,
        played,
        won,
        drawn: 0,
        lost,
        legs_for: legsFor,
        legs_against: legsAgainst,
        points,
      },
      { onConflict: 'fixture_id,user_id' },
    )
  if (error) throw error
  console.log(`  upserted standing for user ${userId}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  Seeding The Southfield…\n')

  // 1. Venue
  console.log('📍  Venue')
  const venueId = await upsertVenue('The Southfield')

  // 2. Sports
  console.log('\n🎯  Sports')
  const dartsId = await upsertSport('darts')
  const poolId = await upsertSport('pool')

  // 3. Stations — 3 darts boards + 1 pool table
  console.log('\n📋  Stations')
  await upsertStation(venueId, dartsId, 'Board 1')
  await upsertStation(venueId, dartsId, 'Board 2')
  await upsertStation(venueId, dartsId, 'Board 3')
  await upsertStation(venueId, poolId, 'Pool Table A')

  // 4. Darts league — Tuesday nights
  console.log('\n🍺  Fixture')
  const fixtureId = await upsertFixture(
    venueId,
    dartsId,
    'Tuesday Darts League',
    2, // Tuesday (0=Sun)
    '19:30',
  )

  // 5. Players
  console.log('\n👥  Players')
  const playerNames = [
    'Alice Thorn',
    'Ben Cartwright',
    'Chloe Finch',
    'Danny Webb',
    'Emma Price',
    "Finn O'Reilly",
    'Grace Sullivan',
    'Harry Kane',
  ]

  // Realistic standings: [played, won, lost, legsFor, legsAgainst]
  const standings: [number, number, number, number, number][] = [
    [8, 7, 1, 21, 9],  // Alice — top
    [8, 6, 2, 19, 11],
    [8, 5, 3, 17, 13],
    [7, 4, 3, 14, 12],
    [7, 3, 4, 12, 15],
    [8, 3, 5, 11, 17],
    [7, 1, 6, 8, 19],
    [8, 0, 8, 5, 22],  // Harry — bottom
  ]

  for (let i = 0; i < playerNames.length; i++) {
    const userId = await upsertUser(playerNames[i])
    const [played, won, lost, legsFor, legsAgainst] = standings[i]
    await upsertStanding(fixtureId, userId, played, won, lost, legsFor, legsAgainst)
  }

  console.log('\n✅  Done! The Southfield is ready to demo.\n')
  console.log('   → Open the app and go to /bar to get started.')
  console.log('   → Standings are at /standings\n')
}

main().catch(err => {
  console.error('❌  Seed failed:', err.message ?? err)
  process.exit(1)
})

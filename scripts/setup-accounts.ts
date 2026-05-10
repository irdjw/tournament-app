/**
 * One-time account setup: creates the super-admin / personal-venue account.
 *
 * Usage — add SUPABASE_SERVICE_ROLE_KEY to frontend/.env.local, then run:
 *   npx ts-node scripts/setup-accounts.ts
 *
 * Required env vars (loaded from frontend/.env.local then frontend/.env):
 *   VITE_SUPABASE_URL          (already in frontend/.env)
 *   VITE_SUPABASE_ANON_KEY     (already in frontend/.env)
 *   SUPABASE_SERVICE_ROLE_KEY  (add to frontend/.env.local — never commit this)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ─── Load env files ───────────────────────────────────────────────────────────

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
}

const root = path.resolve(__dirname, '../frontend')
loadEnvFile(path.join(root, '.env.local'))
loadEnvFile(path.join(root, '.env'))

// ─── Clients ──────────────────────────────────────────────────────────────────

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!url || !anonKey) {
  console.error('❌  Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}
if (!serviceKey) {
  console.error('❌  Missing SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Add it to frontend/.env.local (never commit this file)')
  process.exit(1)
}

// Use service-role client for everything — bypasses RLS for seed operations
const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const admin = db

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertAuthUser(email: string, password: string): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users?.find(u => u.email === email)
  if (existing) {
    console.log(`  auth user "${email}" already exists → ${existing.id}`)
    return existing.id
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  console.log(`  created auth user "${email}" → ${data.user.id}`)
  return data.user.id
}

async function upsertPlatformAdmin(authUserId: string): Promise<void> {
  const { data: existing } = await db
    .from('platform_admins')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle()
  if (existing) { console.log('  platform_admin record already exists'); return }
  const { error } = await admin.from('platform_admins').insert({ user_id: authUserId })
  if (error) throw error
  console.log('  created platform_admin record')
}

async function upsertVenue(name: string, slug: string): Promise<string> {
  const { data: existing } = await db.from('venues').select('id').eq('slug', slug).maybeSingle()
  if (existing) { console.log(`  venue "${name}" already exists → ${existing.id}`); return existing.id }
  const { data, error } = await db.from('venues').insert({ name, slug }).select('id').single()
  if (error) throw error
  console.log(`  created venue "${name}" → ${data.id}`)
  return data.id
}

async function upsertVenueAdmin(authUserId: string, venueId: string): Promise<void> {
  const { data: existing } = await db
    .from('venue_admins')
    .select('id')
    .eq('user_id', authUserId)
    .eq('venue_id', venueId)
    .maybeSingle()
  if (existing) { console.log('  venue_admin record already exists'); return }
  const { error } = await admin
    .from('venue_admins')
    .insert({ user_id: authUserId, venue_id: venueId, role: 'admin' })
  if (error) throw error
  console.log('  created venue_admin record')
}

async function upsertSport(name: string): Promise<string> {
  const { data: existing } = await db.from('sports').select('id').eq('name', name).maybeSingle()
  if (existing) { console.log(`  sport "${name}" already exists → ${existing.id}`); return existing.id }
  const { data, error } = await db.from('sports').insert({ name }).select('id').single()
  if (error) throw error
  console.log(`  created sport "${name}" → ${data.id}`)
  return data.id
}

async function upsertStation(venueId: string, sportId: string, name: string): Promise<void> {
  const { data: existing } = await db
    .from('stations')
    .select('id')
    .eq('venue_id', venueId)
    .eq('name', name)
    .maybeSingle()
  if (existing) { console.log(`  station "${name}" already exists`); return }
  const { error } = await db
    .from('stations')
    .insert({ venue_id: venueId, sport_id: sportId, name, status: 'available' })
  if (error) throw error
  console.log(`  created station "${name}"`)
}

async function upsertPlayer(name: string, venueId: string): Promise<string> {
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@davids-league.demo`
  const { data, error } = await db
    .from('users')
    .upsert({ name, email, venue_id: venueId }, { onConflict: 'email' })
    .select('id')
    .single()
  if (error) throw error
  console.log(`  upserted player "${name}" → ${data.id}`)
  return data.id
}

async function upsertFixture(
  venueId: string,
  sportId: string,
  name: string,
  dayOfWeek: number,
): Promise<string> {
  const { data: existing } = await db
    .from('fixtures')
    .select('id')
    .eq('venue_id', venueId)
    .eq('name', name)
    .maybeSingle()
  if (existing) { console.log(`  fixture "${name}" already exists → ${existing.id}`); return existing.id }
  const { data, error } = await db
    .from('fixtures')
    .insert({ venue_id: venueId, sport_id: sportId, name, day_of_week: dayOfWeek, start_time: '19:30', active: true })
    .select('id')
    .single()
  if (error) throw error
  console.log(`  created fixture "${name}" → ${data.id}`)
  return data.id
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n⚡  Setting up accounts…\n')

  const email = 'd.w85@icloud.com'
  const password = 'Th#9mK$vL2pX@nQ8'

  // 1. Auth user
  console.log('🔐  Auth user')
  const authUserId = await upsertAuthUser(email, password)

  // 2. Platform admin
  console.log('\n🌐  Platform admin')
  await upsertPlatformAdmin(authUserId)

  // 3. Personal venue
  console.log('\n🏠  Personal venue')
  const venueId = await upsertVenue("David's League", 'davids-league')

  // 4. Venue admin link
  console.log('\n🔑  Venue admin link')
  await upsertVenueAdmin(authUserId, venueId)

  // 5. Sports
  console.log('\n🎯  Sports')
  const dartsId = await upsertSport('darts')
  const poolId = await upsertSport('pool')

  // 6. Stations
  console.log('\n📋  Stations')
  await upsertStation(venueId, dartsId, 'Board 1')
  await upsertStation(venueId, dartsId, 'Board 2')
  await upsertStation(venueId, poolId, 'Pool Table 1')
  await upsertStation(venueId, poolId, 'Pool Table 2')

  // 7. Players
  console.log('\n👥  Players')
  for (let i = 1; i <= 6; i++) {
    await upsertPlayer(`Player ${i}`, venueId)
  }

  // 8. Fixture
  console.log('\n🍺  Fixture')
  await upsertFixture(venueId, dartsId, 'Friday Night Darts', 5) // 5 = Friday

  console.log('\n✅  Done!\n')
  console.log('   Login:    ' + email)
  console.log('   Password: ' + password)
  console.log('   Venue:    /v/davids-league')
  console.log('   Admin:    /admin  (choose Personal or God Mode)\n')
}

main().catch(err => {
  console.error('❌  Setup failed:', err.message ?? err)
  process.exit(1)
})

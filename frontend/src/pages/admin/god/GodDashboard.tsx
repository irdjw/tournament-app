import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Settings, Activity, ShieldAlert } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface PlatformStats {
  totalVenues: number
  totalPlayers: number
  totalMatchesPlayed: number
  activeTournaments: number
}

interface VenueRow {
  id: string
  name: string
  slug: string
  activeFixtures: number
  activeTournaments: number
  lastMatch: string | null
  playerCount: number
}

interface ActivityItem {
  id: string
  completedAt: string | null
  createdAt: string
  venueName: string
  sportName: string
}

function StatCard({ label, value, color = 'text-white' }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

export default function GodDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [venues, setVenues] = useState<VenueRow[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()

    // Real-time: refresh activity when any match completes
    const channel = supabase
      .channel('god-mode-matches')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => {
        loadActivity()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function load() {
    try {
      await Promise.all([loadStats(), loadVenues(), loadActivity()])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadStats() {
    const [venueRes, playerRes, matchRes, tourneyRes] = await Promise.all([
      supabase.from('venues').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'complete'),
      supabase.from('tournaments').select('*', { count: 'exact', head: true })
        .in('status', ['active', 'group', 'brackets']),
    ])
    setStats({
      totalVenues: venueRes.count ?? 0,
      totalPlayers: playerRes.count ?? 0,
      totalMatchesPlayed: matchRes.count ?? 0,
      activeTournaments: tourneyRes.count ?? 0,
    })
  }

  async function loadVenues() {
    const { data: venueData, error: vErr } = await supabase
      .from('venues')
      .select('id, name, slug')
      .order('name')
    if (vErr) throw vErr

    const venueIds = (venueData ?? []).map(v => v.id)
    if (venueIds.length === 0) { setVenues([]); return }

    const [fixtureRes, tourneyRes, matchRes] = await Promise.all([
      supabase.from('fixtures').select('id, venue_id').eq('active', true).in('venue_id', venueIds),
      supabase.from('tournaments').select('id, venue_id').in('status', ['active', 'group', 'brackets']).in('venue_id', venueIds),
      supabase.from('matches').select('venue_id, completed_at').eq('status', 'complete').in('venue_id', venueIds).order('completed_at', { ascending: false }),
    ])

    // Count distinct players per venue from matches
    const matchData = (matchRes.data ?? []) as { venue_id: string; completed_at: string | null }[]
    const lastMatchByVenue = new Map<string, string | null>()
    const seenVenue = new Set<string>()
    for (const m of matchData) {
      if (!seenVenue.has(m.venue_id)) {
        seenVenue.add(m.venue_id)
        lastMatchByVenue.set(m.venue_id, m.completed_at)
      }
    }

    const fixtureCountByVenue = new Map<string, number>()
    for (const f of (fixtureRes.data ?? []) as { venue_id: string }[]) {
      fixtureCountByVenue.set(f.venue_id, (fixtureCountByVenue.get(f.venue_id) ?? 0) + 1)
    }

    const tourneyCountByVenue = new Map<string, number>()
    for (const t of (tourneyRes.data ?? []) as { venue_id: string }[]) {
      tourneyCountByVenue.set(t.venue_id, (tourneyCountByVenue.get(t.venue_id) ?? 0) + 1)
    }

    setVenues((venueData ?? []).map(v => ({
      id: v.id,
      name: v.name,
      slug: v.slug ?? '',
      activeFixtures: fixtureCountByVenue.get(v.id) ?? 0,
      activeTournaments: tourneyCountByVenue.get(v.id) ?? 0,
      lastMatch: lastMatchByVenue.get(v.id) ?? null,
      playerCount: (matchData.filter(m => m.venue_id === v.id).length), // match count as proxy
    })))
  }

  async function loadActivity() {
    const { data } = await supabase
      .from('matches')
      .select('id, created_at, completed_at, venue:venue_id(name), sport:sport_id(name)')
      .eq('status', 'complete')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(20)

    setActivity((data ?? []).map((m: any) => ({
      id: m.id,
      completedAt: m.completed_at,
      createdAt: m.created_at,
      venueName: m.venue?.name ?? '—',
      sportName: m.sport?.name ?? '—',
    })))
  }

  function formatTime(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Loading platform data…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300 text-sm">{error}</div>
    )
  }

  // Flag venues with no activity for 30+ days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const churnRisk = venues.filter(v => !v.lastMatch || v.lastMatch < thirtyDaysAgo)

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-sm text-gray-400 mt-1">All venues, all data.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Venues"      value={stats?.totalVenues ?? 0} color="text-red-300" />
        <StatCard label="Total Players"     value={stats?.totalPlayers ?? 0} />
        <StatCard label="Matches Played"    value={stats?.totalMatchesPlayed ?? 0} />
        <StatCard label="Active Tournaments" value={stats?.activeTournaments ?? 0} color="text-purple-300" />
      </div>

      {/* Venues table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">All Venues</h2>
        </div>
        {venues.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500">No venues yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left px-5 py-3 font-medium">Venue</th>
                  <th className="text-left px-3 py-3 font-medium hidden lg:table-cell">Slug</th>
                  <th className="text-right px-3 py-3 font-medium">Fixtures</th>
                  <th className="text-right px-3 py-3 font-medium">Tournaments</th>
                  <th className="text-left px-3 py-3 font-medium hidden md:table-cell">Last Match</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {venues.map(v => (
                  <tr key={v.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">
                      {v.name}
                      {churnRisk.some(c => c.id === v.id) && (
                        <span className="ml-2 text-[10px] text-amber-400 bg-amber-900/30 border border-amber-800/50 px-1.5 py-0.5 rounded-full font-normal">
                          inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-500 font-mono text-xs hidden lg:table-cell">{v.slug}</td>
                    <td className="px-3 py-3 text-right text-gray-300">{v.activeFixtures}</td>
                    <td className="px-3 py-3 text-right text-gray-300">{v.activeTournaments}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs hidden md:table-cell">{formatTime(v.lastMatch)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/v/${v.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                          title="View public page"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <Link
                          to={`/admin/god/venue/${v.id}`}
                          className="p-1.5 rounded text-gray-400 hover:text-red-300 hover:bg-red-900/30 transition-colors"
                          title="Manage venue"
                        >
                          <Settings className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity feed */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
            <span className="ml-auto text-xs text-gray-500">live</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </div>
          {activity.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500">No completed matches yet.</p>
          ) : (
            <ul className="divide-y divide-gray-800/50">
              {activity.map(item => (
                <li key={item.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-white font-medium">{item.venueName}</p>
                    <p className="text-xs text-gray-500 capitalize">{item.sportName}</p>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{formatTime(item.completedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Platform health */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Platform Health</h2>
          </div>
          <ul className="divide-y divide-gray-800/50">
            <li className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-300">Supabase</span>
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Connected
              </span>
            </li>
            <li className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-300">Total venues</span>
              <span className="text-sm text-white font-medium">{stats?.totalVenues ?? 0}</span>
            </li>
            <li className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-300">Active tournaments</span>
              <span className="text-sm text-white font-medium">{stats?.activeTournaments ?? 0}</span>
            </li>
            {churnRisk.length > 0 && (
              <li className="px-5 py-4">
                <p className="text-xs text-amber-400 font-medium mb-2">Churn risk (30+ days inactive)</p>
                <ul className="space-y-1">
                  {churnRisk.map(v => (
                    <li key={v.id} className="flex items-center justify-between">
                      <span className="text-xs text-gray-300">{v.name}</span>
                      <span className="text-xs text-gray-500">
                        {v.lastMatch ? `Last: ${formatTime(v.lastMatch)}` : 'No matches'}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

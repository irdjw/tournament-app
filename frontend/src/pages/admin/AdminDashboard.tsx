import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface StandingRow {
  user: { id: string; name: string }
  points: number
  wins: number
  losses: number
  played: number
}

interface DashboardData {
  activePlayers: number
  matchesThisWeek: number
  topStandings: StandingRow[]
  activeFixture: { id: string; name: string } | null
  activeTournament: { id: string; name: string; status: string } | null
  stationsTotal: number
  stationsInUse: number
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-sm text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

const STATUS_LABEL: Record<string, string> = {
  setup: 'Setup',
  active: 'Active',
  group: 'Group Stage',
  brackets: 'Brackets',
  complete: 'Complete',
}

export default function AdminDashboard() {
  const { venueAdmin } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!venueAdmin?.venue_id) return

    async function load() {
      const venueId = venueAdmin!.venue_id

      try {
        const { data: fixtureData } = await supabase
          .from('fixtures')
          .select('id, name')
          .eq('venue_id', venueId)
          .eq('active', true)
          .order('created_at', { ascending: false })

        const fixtureIds = (fixtureData ?? []).map((f: any) => f.id)
        const activeFixture = fixtureData?.[0]
          ? { id: fixtureData[0].id, name: fixtureData[0].name }
          : null

        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        weekStart.setHours(0, 0, 0, 0)

        const [matchesRes, tournamentRes, stationsRes, standingsRes, playerIdsRes] = await Promise.all([
          supabase
            .from('matches')
            .select('id', { count: 'exact', head: true })
            .eq('venue_id', venueId)
            .gte('created_at', weekStart.toISOString()),
          supabase
            .from('tournaments')
            .select('id, name, status')
            .eq('venue_id', venueId)
            .in('status', ['active', 'group', 'brackets'])
            .limit(1),
          supabase
            .from('stations')
            .select('id, status')
            .eq('venue_id', venueId),
          fixtureIds.length > 0
            ? supabase
                .from('standings')
                .select('user_id, points, wins, losses, played, user:user_id(id, name)')
                .in('fixture_id', fixtureIds)
            : Promise.resolve({ data: [] as any[], error: null }),
          fixtureIds.length > 0
            ? supabase
                .from('standings')
                .select('user_id')
                .in('fixture_id', fixtureIds)
            : Promise.resolve({ data: [] as any[], error: null }),
        ])

        // Aggregate standings by user across fixtures
        const userMap = new Map<string, StandingRow>()
        for (const row of (standingsRes.data ?? []) as any[]) {
          const uid = row.user_id
          if (!userMap.has(uid)) {
            userMap.set(uid, { user: row.user, points: 0, wins: 0, losses: 0, played: 0 })
          }
          const e = userMap.get(uid)!
          e.points += row.points ?? 0
          e.wins += row.wins ?? 0
          e.losses += row.losses ?? 0
          e.played += row.played ?? 0
        }
        const topStandings = [...userMap.values()]
          .sort((a, b) => b.points - a.points)
          .slice(0, 5)

        const stations = (stationsRes.data ?? []) as any[]
        const uniquePlayers = new Set((playerIdsRes.data ?? []).map((r: any) => r.user_id)).size

        setData({
          activePlayers: uniquePlayers,
          matchesThisWeek: matchesRes.count ?? 0,
          topStandings,
          activeFixture,
          activeTournament: ((tournamentRes.data ?? []) as any[])[0] ?? null,
          stationsTotal: stations.length,
          stationsInUse: stations.filter((s: any) => s.status === 'in_use').length,
        })
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [venueAdmin?.venue_id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Overview for {venueAdmin?.venue?.name}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Players" value={data?.activePlayers ?? 0} sub="this season" />
        <StatCard label="Matches This Week" value={data?.matchesThisWeek ?? 0} />
        <StatCard
          label="Stations"
          value={`${data?.stationsInUse ?? 0} / ${data?.stationsTotal ?? 0}`}
          sub="in use"
        />
        <StatCard
          label="Active Tournament"
          value={data?.activeTournament ? STATUS_LABEL[data.activeTournament.status] ?? '—' : '—'}
          sub={data?.activeTournament?.name}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* League standings */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">
              {data?.activeFixture ? data.activeFixture.name : 'League Standings'}
            </h2>
            {data?.activeFixture && (
              <Link
                to={`/admin/leagues/${data.activeFixture.id}`}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                View all →
              </Link>
            )}
          </div>
          {(data?.topStandings.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500">No standings yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left pb-2 font-medium">#</th>
                  <th className="text-left pb-2 font-medium">Player</th>
                  <th className="text-right pb-2 font-medium">P</th>
                  <th className="text-right pb-2 font-medium">W</th>
                  <th className="text-right pb-2 font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {data?.topStandings.map((row, i) => (
                  <tr key={row.user?.id ?? i} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-500 text-xs">{i + 1}</td>
                    <td className="py-2 text-white font-medium">{row.user?.name ?? '—'}</td>
                    <td className="py-2 text-right text-gray-400">{row.played}</td>
                    <td className="py-2 text-right text-gray-400">{row.wins}</td>
                    <td className="py-2 text-right text-purple-300 font-semibold">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/admin/leagues/new"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors"
            >
              <span className="text-lg">🎯</span>
              <span>Start League Night</span>
            </Link>
            <Link
              to="/admin/tournaments"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors"
            >
              <span className="text-lg">🏆</span>
              <span>New Tournament</span>
            </Link>
            <Link
              to="/admin/players"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors"
            >
              <span className="text-lg">👤</span>
              <span>Add Player</span>
            </Link>
            <Link
              to="/admin/stations"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors"
            >
              <span className="text-lg">📋</span>
              <span>Manage Stations</span>
            </Link>
            <Link
              to="/bar"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-amber-900/40 hover:bg-amber-900/60 text-amber-300 text-sm transition-colors border border-amber-800/40"
            >
              <span className="text-lg">📱</span>
              <span>Switch to Bar Mode</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Active tournament card */}
      {data?.activeTournament && (
        <div className="bg-gray-900 border border-purple-800/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-400 uppercase tracking-wide font-medium">Active Tournament</p>
              <p className="text-lg font-semibold text-white mt-1">{data.activeTournament.name}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {STATUS_LABEL[data.activeTournament.status] ?? data.activeTournament.status}
              </p>
            </div>
            <Link
              to={`/admin/tournaments/${data.activeTournament.id}`}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
            >
              Manage
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

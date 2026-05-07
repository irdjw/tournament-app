import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

interface LiveMatch {
  id: string
  sport: string
  players: Array<{ name: string; legs_won: number }>
  current_leg: number
  legs_to_win: number
  station: string | null
}

interface StandingRow {
  user: { name: string }
  points: number
  wins: number
  played: number
}

interface Tournament {
  id: string
  name: string
  status: string
}

interface Fixture {
  id: string
  name: string
  day_of_week: number
  start_time: string
}

interface RecentResult {
  id: string
  created_at: string
  sport: string
  players: Array<{ name: string; legs_won: number }>
}

function PulsingDot() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
    </span>
  )
}

function LiveMatchCard({ match, slug }: { match: LiveMatch; slug: string }) {
  const [p1, p2] = match.players
  return (
    <Link
      to={`/v/${slug}/live`}
      className="block bg-gray-800/60 rounded-xl p-4 hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{match.sport === 'darts' ? '🎯' : '🎱'}</span>
        {match.station && (
          <span className="text-xs text-gray-500">{match.station}</span>
        )}
        <span className="ml-auto text-xs text-gray-500">Leg {match.current_leg}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-white font-medium text-sm flex-1 truncate">{p1?.name ?? '—'}</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xl font-bold text-white tabular-nums">{p1?.legs_won ?? 0}</span>
          <span className="text-gray-600 text-xs">–</span>
          <span className="text-xl font-bold text-white tabular-nums">{p2?.legs_won ?? 0}</span>
        </div>
        <span className="text-white font-medium text-sm flex-1 truncate text-right">{p2?.name ?? '—'}</span>
      </div>
    </Link>
  )
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const STATUS_LABEL: Record<string, string> = {
  active: 'Active', group: 'Group Stage', brackets: 'Brackets', setup: 'Setup', complete: 'Complete',
}

function nextOccurrence(dayOfWeek: number): Date {
  const today = new Date()
  const diff = (dayOfWeek - today.getDay() + 7) % 7 || 7
  const d = new Date(today)
  d.setDate(today.getDate() + diff)
  return d
}

export default function VenueHome() {
  const venue = useVenue()
  useDocumentTitle(`${venue.name} — Live Darts`)

  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([])
  const [topStandings, setTopStandings] = useState<StandingRow[]>([])
  const [activeFixture, setActiveFixture] = useState<Fixture | null>(null)
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null)
  const [upcomingFixtures, setUpcomingFixtures] = useState<Fixture[]>([])
  const [recentResults, setRecentResults] = useState<RecentResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [liveRes, fixtureRes, tourRes, resultsRes, stationsRes] = await Promise.all([
        supabase
          .from('matches')
          .select('id, match_type, legs_to_win, current_leg, sport:sport_id(name), match_players(user_id, team_id, legs_won, users(name))')
          .eq('venue_id', venue.id)
          .eq('status', 'in_progress'),
        supabase
          .from('fixtures')
          .select('id, name, day_of_week, start_time')
          .eq('venue_id', venue.id)
          .eq('active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('tournaments')
          .select('id, name, status')
          .eq('venue_id', venue.id)
          .in('status', ['active', 'group', 'brackets'])
          .limit(1),
        supabase
          .from('matches')
          .select('id, created_at, sport:sport_id(name), match_players(user_id, team_id, legs_won, users(name))')
          .eq('venue_id', venue.id)
          .eq('status', 'complete')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('stations')
          .select('name, current_match_id')
          .eq('venue_id', venue.id)
          .not('current_match_id', 'is', null),
      ])

      // Build station lookup
      const stationByMatch = new Map<string, string>()
      for (const s of (stationsRes.data ?? []) as any[]) {
        if (s.current_match_id) stationByMatch.set(s.current_match_id, s.name)
      }

      const live: LiveMatch[] = (liveRes.data ?? []).map((m: any) => ({
        id: m.id,
        sport: (m.sport as any)?.name ?? 'darts',
        players: ((m.match_players ?? []) as any[])
          .sort((a: any, b: any) => a.team_id.localeCompare(b.team_id))
          .map((p: any) => ({ name: p.users?.name ?? '—', legs_won: p.legs_won ?? 0 })),
        current_leg: m.current_leg ?? 1,
        legs_to_win: m.legs_to_win ?? 2,
        station: stationByMatch.get(m.id) ?? null,
      }))
      setLiveMatches(live)

      const fixtures = (fixtureRes.data ?? []) as Fixture[]
      const firstFixture = fixtures[0] ?? null
      setActiveFixture(firstFixture)
      setUpcomingFixtures(fixtures.slice(0, 3))
      setActiveTournament(((tourRes.data ?? []) as any[])[0] ?? null)

      const results: RecentResult[] = (resultsRes.data ?? []).map((m: any) => ({
        id: m.id,
        created_at: m.created_at,
        sport: (m.sport as any)?.name ?? 'darts',
        players: ((m.match_players ?? []) as any[])
          .sort((a: any, b: any) => a.team_id.localeCompare(b.team_id))
          .map((p: any) => ({ name: p.users?.name ?? '—', legs_won: p.legs_won ?? 0 })),
      }))
      setRecentResults(results)

      // Fetch standings for first active fixture
      if (firstFixture?.id) {
        const { data: sData } = await supabase
          .from('standings')
          .select('user_id, points, wins, played, user:user_id(id, name)')
          .eq('fixture_id', firstFixture.id)
          .order('points', { ascending: false })
          .limit(5)
        setTopStandings((sData ?? []) as any[])
      }

      setLoading(false)
    }

    load()
  }, [venue.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-4xl">🎯</span>
        </div>
        <h1 className="text-4xl font-bold text-white">{venue.name}</h1>
        <div className="flex gap-2 mt-3">
          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
            🎯 Darts
          </span>
        </div>
      </div>

      {/* Live now */}
      {liveMatches.length > 0 && (
        <div className="bg-green-950/30 border border-green-800/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <PulsingDot />
            <h2 className="text-green-400 font-semibold text-sm uppercase tracking-wide">Live Now</h2>
            <Link
              to={`/v/${venue.slug}/live`}
              className="ml-auto text-xs text-green-400 hover:text-green-300 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {liveMatches.slice(0, 3).map(m => (
              <LiveMatchCard key={m.id} match={m} slug={venue.slug} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* League standings */}
        {activeFixture && topStandings.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">{activeFixture.name}</h2>
              <Link
                to={`/v/${venue.slug}/standings`}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Full table →
              </Link>
            </div>
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
                {topStandings.map((row, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-500 text-xs">{i + 1}</td>
                    <td className="py-2 text-white font-medium">{(row.user as any)?.name ?? '—'}</td>
                    <td className="py-2 text-right text-gray-400">{row.played}</td>
                    <td className="py-2 text-right text-gray-400">{row.wins}</td>
                    <td className="py-2 text-right text-purple-300 font-bold">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Active tournament */}
        {activeTournament && (
          <div className="bg-gray-900 border border-purple-800/30 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-purple-400 uppercase tracking-wide font-medium">Tournament</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                activeTournament.status === 'brackets'
                  ? 'bg-purple-900/50 text-purple-300'
                  : 'bg-blue-900/40 text-blue-300'
              }`}>
                {STATUS_LABEL[activeTournament.status] ?? activeTournament.status}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mb-4">{activeTournament.name}</h2>
            <Link
              to={`/v/${venue.slug}/tournament/${activeTournament.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
            >
              View bracket →
            </Link>
          </div>
        )}
      </div>

      {/* Upcoming fixtures */}
      {upcomingFixtures.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-3">Upcoming Fixture Nights</h2>
          <div className="space-y-2">
            {upcomingFixtures.map(f => {
              const next = nextOccurrence(f.day_of_week)
              const next2 = new Date(next)
              next2.setDate(next2.getDate() + 7)
              return [next, next2].slice(0, 1).map((date, i) => (
                <div key={`${f.id}-${i}`} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-5 py-3.5">
                  <div>
                    <p className="text-white text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {DAYS[f.day_of_week]} · {f.start_time ?? ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-300">{date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
              ))
            })}
          </div>
        </div>
      )}

      {/* Recent results */}
      {recentResults.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Recent Results</h2>
            <Link to={`/v/${venue.slug}/results`} className="text-xs text-purple-400 hover:text-purple-300">
              All results →
            </Link>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
            {recentResults.map(result => {
              const [p1, p2] = result.players
              const winner = p1 && p2 ? (p1.legs_won > p2.legs_won ? p1 : p2) : null
              return (
                <div key={result.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={p1 === winner ? 'text-white font-medium' : 'text-gray-400'}>
                        {p1?.name ?? '—'}
                      </span>
                      <span className="text-gray-600 text-xs shrink-0">vs</span>
                      <span className={p2 === winner ? 'text-white font-medium' : 'text-gray-400'}>
                        {p2?.name ?? '—'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {new Date(result.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="text-white font-bold tabular-nums">
                      {p1?.legs_won ?? 0}–{p2?.legs_won ?? 0}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

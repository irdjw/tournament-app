import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

interface LiveMatch {
  id: string
  sport: string
  players: Array<{ name: string; legs_won: number; team_id: string }>
  current_leg: number
  legs_to_win: number
  station: string | null
}

interface LastResult {
  players: Array<{ name: string; legs_won: number }>
  completed_at: string
}

function PulsingScore({ value }: { value: number }) {
  return (
    <span className="text-5xl font-black text-white tabular-nums leading-none">
      {value}
    </span>
  )
}

function LiveCard({ match }: { match: LiveMatch }) {
  const [p1, p2] = match.players
  return (
    <div className="bg-gray-900 border border-green-800/30 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-xs text-green-400 font-semibold uppercase tracking-wide">Live</span>
          {match.station && (
            <span className="text-xs text-gray-500 ml-1">· {match.station}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>{match.sport === 'darts' ? '🎯' : '🎱'}</span>
          <span>Leg {match.current_leg} of {match.legs_to_win ? match.legs_to_win * 2 - 1 : '?'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* Player 1 */}
        <div className="flex-1 text-center">
          <p className="text-sm text-gray-300 font-medium truncate mb-3">{p1?.name ?? 'TBD'}</p>
          <div className="inline-flex items-center justify-center">
            <PulsingScore value={p1?.legs_won ?? 0} />
          </div>
          <p className="text-xs text-gray-600 mt-1">legs won</p>
        </div>

        {/* Divider */}
        <div className="text-gray-700 text-2xl font-light shrink-0">vs</div>

        {/* Player 2 */}
        <div className="flex-1 text-center">
          <p className="text-sm text-gray-300 font-medium truncate mb-3">{p2?.name ?? 'TBD'}</p>
          <div className="inline-flex items-center justify-center">
            <PulsingScore value={p2?.legs_won ?? 0} />
          </div>
          <p className="text-xs text-gray-600 mt-1">legs won</p>
        </div>
      </div>
    </div>
  )
}

export default function LiveScores() {
  const venue = useVenue()
  useDocumentTitle(`${venue.name} — Live Scores`)

  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [lastResult, setLastResult] = useState<LastResult | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadMatches() {
    const [liveRes, stationsRes] = await Promise.all([
      supabase
        .from('matches')
        .select('id, legs_to_win, current_leg, sport:sport_id(name), match_players(user_id, team_id, legs_won, users(name))')
        .eq('venue_id', venue.id)
        .eq('status', 'in_progress'),
      supabase
        .from('stations')
        .select('name, current_match_id')
        .eq('venue_id', venue.id)
        .not('current_match_id', 'is', null),
    ])

    const stationByMatch = new Map<string, string>()
    for (const s of (stationsRes.data ?? []) as any[]) {
      if (s.current_match_id) stationByMatch.set(s.current_match_id, s.name)
    }

    setMatches(
      (liveRes.data ?? []).map((m: any) => ({
        id: m.id,
        sport: (m.sport as any)?.name ?? 'darts',
        players: ((m.match_players ?? []) as any[])
          .sort((a: any, b: any) => a.team_id.localeCompare(b.team_id))
          .map((p: any) => ({ name: p.users?.name ?? '—', legs_won: p.legs_won ?? 0, team_id: p.team_id })),
        current_leg: m.current_leg ?? 1,
        legs_to_win: m.legs_to_win ?? 2,
        station: stationByMatch.get(m.id) ?? null,
      })),
    )
    setLoading(false)
  }

  async function loadLastResult() {
    const { data } = await supabase
      .from('matches')
      .select('created_at, match_players(team_id, legs_won, users(name))')
      .eq('venue_id', venue.id)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      const players = ((data as any).match_players ?? [])
        .sort((a: any, b: any) => a.team_id.localeCompare(b.team_id))
        .map((p: any) => ({ name: p.users?.name ?? '—', legs_won: p.legs_won ?? 0 }))
      setLastResult({ players, completed_at: (data as any).created_at })
    }
  }

  useEffect(() => {
    loadMatches()
    loadLastResult()

    const channel = supabase
      .channel(`live-${venue.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `venue_id=eq.${venue.id}` },
        () => { loadMatches(); loadLastResult() },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_players' },
        () => loadMatches(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [venue.id])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Live Scores</h1>
        {matches.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-xs text-green-400 font-medium">{matches.length} match{matches.length !== 1 ? 'es' : ''} live</span>
          </div>
        )}
        </div>
        <a
          href={`/display/${venue.slug}/scoreboard`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors border border-gray-700"
        >
          📺 Display Mode ↗
        </a>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm py-12 text-center">Loading…</p>
      ) : matches.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
          <p className="text-2xl mb-3">😴</p>
          <p className="text-white font-medium">No matches currently live</p>
          <p className="text-sm text-gray-500 mt-1">Check back when a match is in progress</p>
          {lastResult && (
            <div className="mt-6 pt-6 border-t border-gray-800">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Last Result</p>
              <div className="flex items-center justify-center gap-4 text-sm">
                <span className={lastResult.players[0]?.legs_won > lastResult.players[1]?.legs_won ? 'text-white font-semibold' : 'text-gray-400'}>
                  {lastResult.players[0]?.name ?? '—'}
                </span>
                <span className="font-bold text-white tabular-nums text-lg">
                  {lastResult.players[0]?.legs_won ?? 0}–{lastResult.players[1]?.legs_won ?? 0}
                </span>
                <span className={lastResult.players[1]?.legs_won > lastResult.players[0]?.legs_won ? 'text-white font-semibold' : 'text-gray-400'}>
                  {lastResult.players[1]?.name ?? '—'}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {new Date(lastResult.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {matches.map(m => <LiveCard key={m.id} match={m} />)}
        </div>
      )}

      <p className="text-xs text-gray-600 text-center">Updates automatically · no refresh needed</p>
    </div>
  )
}

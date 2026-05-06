import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  getTournamentFull,
  getActiveMatches,
  type Tournament,
  type TournamentGroup,
  type TournamentMatch,
} from '../../lib/tournaments'

// ─── Clock ────────────────────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )
  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }, 1000)
    return () => clearInterval(t)
  }, [])
  return <span className="font-mono text-white text-2xl tabular-nums">{time}</span>
}

// ─── Active Match Card ────────────────────────────────────────────────────────

function ActiveMatchCard({ match }: { match: TournamentMatch }) {
  const playerA = match.player_a?.name ?? 'TBD'
  const playerB = match.player_b?.name ?? 'TBD'
  const roundLabel = match.group ? `${match.group.name} · Rd ${match.round}` : `Round ${match.round}`

  return (
    <div className="bg-gray-800 border-2 border-amber-500 rounded-2xl p-5 flex flex-col gap-3 shadow-lg shadow-amber-500/10">
      <div className="flex items-center justify-between">
        <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">▶ Live</span>
        {match.station && (
          <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">
            Board {match.station}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1 bg-gray-700 rounded-xl px-4 py-3 text-center">
          <span className="text-white text-2xl font-black truncate block">{playerA}</span>
        </div>
        <span className="text-gray-500 text-lg font-bold">vs</span>
        <div className="flex-1 bg-gray-700 rounded-xl px-4 py-3 text-center">
          <span className="text-white text-2xl font-black truncate block">{playerB}</span>
        </div>
      </div>
      <div className="text-center text-gray-500 text-xs font-medium uppercase tracking-wide">
        {roundLabel}
      </div>
    </div>
  )
}

// ─── Recent Result Row ────────────────────────────────────────────────────────

function RecentResult({ match }: { match: TournamentMatch }) {
  const winner = match.winner?.name ?? 'Unknown'
  const loser =
    match.winner_id === match.player_a_id
      ? match.player_b?.name ?? 'Unknown'
      : match.player_a?.name ?? 'Unknown'
  const roundLabel = match.group ? `${match.group.name} · Rd ${match.round}` : `Round ${match.round}`

  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-800 last:border-0">
      <div className="flex-1 flex items-center gap-3">
        <span className="text-green-400 text-xl font-black">{winner}</span>
        <span className="text-gray-600 text-sm">def.</span>
        <span className="text-gray-500 text-xl font-semibold">{loser}</span>
      </div>
      <span className="text-gray-600 text-xs font-medium uppercase tracking-wide whitespace-nowrap">
        {roundLabel}
      </span>
    </div>
  )
}

// ─── Bracket Progress Panel ───────────────────────────────────────────────────

function BracketProgress({
  groups,
  matches,
}: {
  groups: TournamentGroup[]
  matches: TournamentMatch[]
}) {
  const bracketGroups = groups.filter(
    g => g.group_type === 'winners' || g.group_type === 'losers' || g.group_type === 'grand_final'
  )

  if (bracketGroups.length === 0) {
    const groupGroups = groups.filter(g => g.group_type === 'group')
    if (groupGroups.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-600 text-xl">
          Bracket not yet generated
        </div>
      )
    }
    // Show group stage progress
    return (
      <div className="flex flex-wrap gap-4 items-center justify-center h-full">
        {groupGroups.map(g => {
          const gm = matches.filter(m => m.group_id === g.id)
          const total = gm.filter(m => m.player_a_id && m.player_b_id).length
          const done = gm.filter(m => m.status === 'complete').length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          return (
            <div key={g.id} className="flex flex-col items-center gap-2 min-w-[100px]">
              <div className="text-white text-lg font-bold">{g.name}</div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className="bg-amber-500 h-3 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-gray-400 text-sm">
                {done}/{total} matches
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-6 items-center justify-center h-full">
      {bracketGroups.map(g => {
        const gm = matches.filter(m => m.group_id === g.id)
        const rounds = new Set(gm.map(m => m.round))
        const maxRound = rounds.size > 0 ? Math.max(...rounds) : 0
        const completedRounds = maxRound > 0
          ? [...rounds].filter(r => gm.filter(m => m.round === r).every(m => m.status === 'complete')).length
          : 0
        const remainingRounds = maxRound - completedRounds

        const typeLabel: Record<string, string> = {
          winners: 'Winners',
          losers: 'Losers',
          grand_final: 'Grand Final',
        }

        return (
          <div key={g.id} className="flex flex-col items-center gap-2 min-w-[120px]">
            <div className={`text-base font-bold uppercase tracking-wide ${
              g.group_type === 'winners' ? 'text-amber-400' :
              g.group_type === 'losers' ? 'text-blue-400' :
              'text-yellow-300'
            }`}>
              {typeLabel[g.group_type] ?? g.name}
            </div>
            <div className="text-5xl font-black text-white tabular-nums">
              {remainingRounds}
            </div>
            <div className="text-gray-500 text-sm">
              round{remainingRounds !== 1 ? 's' : ''} remaining
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-700"
                style={{ width: maxRound > 0 ? `${Math.round((completedRounds / maxRound) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TournamentDisplay() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [groups, setGroups] = useState<TournamentGroup[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [venueName, setVenueName] = useState('')
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const load = async () => {
    if (!id) return
    try {
      const data = await getTournamentFull(id)
      setTournament(data.tournament)
      setGroups(data.groups)
      setMatches(data.matches)

      if (data.tournament.venue_id) {
        const { data: venue } = await supabase
          .from('venues')
          .select('name')
          .eq('id', data.tournament.venue_id)
          .single()
        if (venue) setVenueName(venue.name)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    channelRef.current = supabase
      .channel(`tv-tournament-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, load)
      .subscribe()
    return () => { channelRef.current?.unsubscribe() }
  }, [id])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 text-2xl tracking-widest uppercase animate-pulse">Loading…</div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 text-2xl">Tournament not found</div>
      </div>
    )
  }

  const activeMatches = getActiveMatches(matches)
  const recentResults = matches
    .filter(m => m.status === 'complete' && m.winner_id)
    .slice(-5)
    .reverse()

  const isComplete = tournament.status === 'complete'
  const champion = isComplete
    ? matches.find(m => m.group?.group_type === 'grand_final' && m.status === 'complete')?.winner ??
      matches.filter(m => m.status === 'complete' && m.winner_id).at(-1)?.winner
    : null

  return (
    <div className="fixed inset-0 bg-gray-900 text-white flex flex-col overflow-hidden" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800 shrink-0">
        <div>
          <div className="text-3xl font-black tracking-tight text-white leading-none">{tournament.name}</div>
          {venueName && (
            <div className="text-gray-400 text-base mt-0.5 font-medium">{venueName}</div>
          )}
        </div>
        <div className="flex items-center gap-6">
          {isComplete ? (
            <span className="px-4 py-1.5 bg-green-700 text-green-200 font-bold text-sm uppercase tracking-widest rounded-full">
              Complete
            </span>
          ) : (
            <span className="px-4 py-1.5 bg-amber-600 text-black font-bold text-sm uppercase tracking-widest rounded-full animate-pulse">
              Live
            </span>
          )}
          <Clock />
        </div>
      </div>

      {/* ── Champion banner (tournament complete) ── */}
      {isComplete && champion && (
        <div className="shrink-0 mx-8 mt-4 py-4 px-8 bg-yellow-900/40 border-2 border-yellow-500 rounded-2xl text-center">
          <div className="text-yellow-400 text-sm font-bold uppercase tracking-widest mb-1">🏆 Champion</div>
          <div className="text-yellow-200 text-5xl font-black">{champion.name}</div>
        </div>
      )}

      {/* ── Three-thirds layout ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Top third — Active matches */}
        <div className="flex-1 min-h-0 border-b border-gray-800 flex flex-col px-8 py-5">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-4 shrink-0">
            ⚡ Now Playing
          </div>
          {activeMatches.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-xl">
              {isComplete ? 'Tournament complete' : 'No active matches'}
            </div>
          ) : (
            <div className={`flex-1 grid gap-4 content-start overflow-hidden ${
              activeMatches.length === 1 ? 'grid-cols-1' :
              activeMatches.length === 2 ? 'grid-cols-2' :
              'grid-cols-3'
            }`}>
              {activeMatches.slice(0, 6).map(m => (
                <ActiveMatchCard key={m.id} match={m} />
              ))}
            </div>
          )}
        </div>

        {/* Middle third — Recent results */}
        <div className="flex-1 min-h-0 border-b border-gray-800 flex flex-col px-8 py-5">
          <div className="text-xs font-bold uppercase tracking-widest text-green-400 mb-3 shrink-0">
            ✓ Recent Results
          </div>
          {recentResults.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-700 text-lg">
              No results yet
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center divide-y divide-gray-800 rounded-xl bg-gray-800/30 overflow-hidden">
              {recentResults.map(m => (
                <RecentResult key={m.id} match={m} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom third — Bracket progress */}
        <div className="flex-1 min-h-0 flex flex-col px-8 py-5">
          <div className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-4 shrink-0">
            📊 Bracket Progress
          </div>
          <div className="flex-1">
            <BracketProgress groups={groups} matches={matches} />
          </div>
        </div>

      </div>
    </div>
  )
}

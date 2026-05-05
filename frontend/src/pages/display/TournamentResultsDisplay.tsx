import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  getTournamentFull,
  type Tournament,
  type TournamentMatch,
  type TournamentGroup,
} from '../../lib/tournaments'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchScore {
  tournamentMatchId: string
  winnerLegs: number
  loserLegs: number
}

// ─── Fetch scores for completed matches ───────────────────────────────────────

async function fetchScores(
  completedMatches: TournamentMatch[]
): Promise<Record<string, MatchScore>> {
  const withMatchId = completedMatches.filter(m => m.match_id && m.winner_id)
  if (withMatchId.length === 0) return {}

  const matchIds = withMatchId.map(m => m.match_id!)
  const { data } = await supabase
    .from('match_players')
    .select('match_id, user_id, legs_won')
    .in('match_id', matchIds)

  if (!data) return {}

  const result: Record<string, MatchScore> = {}
  for (const tm of withMatchId) {
    const players = data.filter(r => r.match_id === tm.match_id)
    if (players.length < 2) continue
    const winner = players.find(p => p.user_id === tm.winner_id)
    const loser = players.find(p => p.user_id !== tm.winner_id)
    if (winner && loser) {
      result[tm.id] = {
        tournamentMatchId: tm.id,
        winnerLegs: winner.legs_won,
        loserLegs: loser.legs_won,
      }
    }
  }
  return result
}

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
  return <span className="font-mono text-white text-xl tabular-nums">{time}</span>
}

// ─── Result Row ───────────────────────────────────────────────────────────────

function ResultRow({
  match,
  score,
  isNew,
}: {
  match: TournamentMatch
  score: MatchScore | undefined
  isNew: boolean
}) {
  const winner = match.winner?.name ?? 'Unknown'
  const loser =
    match.winner_id === match.player_a_id
      ? match.player_b?.name ?? 'Unknown'
      : match.player_a?.name ?? 'Unknown'
  const roundLabel = match.group
    ? `${match.group.name} · Round ${match.round}`
    : `Round ${match.round}`
  const scoreStr = score ? `Legs: ${score.winnerLegs}–${score.loserLegs}` : null

  return (
    <div
      className={`flex items-center gap-6 px-8 py-6 border-b border-gray-800 transition-all duration-700 ${
        isNew ? 'bg-amber-900/20 border-l-4 border-l-amber-500' : ''
      }`}
    >
      {/* Winner */}
      <div className="flex items-center gap-3 min-w-0" style={{ flex: '0 0 35%' }}>
        <span className="text-yellow-400 text-2xl shrink-0">🏆</span>
        <span className="text-white text-3xl font-black truncate">{winner}</span>
      </div>

      {/* Separator */}
      <div className="text-gray-600 text-xl font-bold shrink-0">defeated</div>

      {/* Loser */}
      <div className="min-w-0" style={{ flex: '0 0 35%' }}>
        <span className="text-gray-500 text-3xl font-semibold truncate block">{loser}</span>
      </div>

      {/* Score + round */}
      <div className="flex-1 flex flex-col items-end gap-0.5 shrink-0">
        {scoreStr && (
          <span className="text-amber-400 text-lg font-bold">{scoreStr}</span>
        )}
        <span className="text-gray-600 text-sm uppercase tracking-wide font-medium">{roundLabel}</span>
      </div>
    </div>
  )
}

// ─── Final Standings ──────────────────────────────────────────────────────────

function FinalStandings({
  groups,
  matches,
}: {
  groups: TournamentGroup[]
  matches: TournamentMatch[]
}) {
  // Find grand final match to get champion
  const grandFinalGroup = groups.find(g => g.group_type === 'grand_final')
  const grandFinalMatch = grandFinalGroup
    ? matches.find(m => m.group_id === grandFinalGroup.id && m.status === 'complete')
    : matches.filter(m => m.status === 'complete').at(-1)

  const champion = grandFinalMatch?.winner
  const runnerUp = grandFinalMatch
    ? grandFinalMatch.winner_id === grandFinalMatch.player_a_id
      ? grandFinalMatch.player_b
      : grandFinalMatch.player_a
    : null

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8 py-12">
      <div className="text-amber-400 text-lg font-black uppercase tracking-widest">
        🏆 Tournament Complete — Final Standings
      </div>

      {champion && (
        <div className="text-center">
          <div className="text-gray-500 text-sm uppercase tracking-widest mb-2">Champion</div>
          <div className="text-white text-7xl font-black">{champion.name}</div>
        </div>
      )}

      {runnerUp && (
        <div className="text-center">
          <div className="text-gray-600 text-sm uppercase tracking-widest mb-2">Runner-up</div>
          <div className="text-gray-400 text-4xl font-bold">{runnerUp.name}</div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TournamentResultsDisplay() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [groups, setGroups] = useState<TournamentGroup[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [scores, setScores] = useState<Record<string, MatchScore>>({})
  const [loading, setLoading] = useState(true)
  const [newMatchIds, setNewMatchIds] = useState<Set<string>>(new Set())
  const prevCompletedIds = useRef<Set<string>>(new Set())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const load = async () => {
    if (!id) return
    try {
      const data = await getTournamentFull(id)
      setTournament(data.tournament)
      setGroups(data.groups)
      setMatches(data.matches)

      const completed = data.matches.filter(m => m.status === 'complete' && m.winner_id)
      const updatedScores = await fetchScores(completed)
      setScores(updatedScores)

      // Detect newly completed matches for highlight animation
      const newIds = completed
        .map(m => m.id)
        .filter(mid => !prevCompletedIds.current.has(mid))
      if (newIds.length > 0) {
        setNewMatchIds(prev => new Set([...prev, ...newIds]))
        // Clear highlight after 4 seconds
        setTimeout(() => {
          setNewMatchIds(prev => {
            const next = new Set(prev)
            newIds.forEach(mid => next.delete(mid))
            return next
          })
        }, 4000)
      }
      prevCompletedIds.current = new Set(completed.map(m => m.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    channelRef.current = supabase
      .channel(`tv-results-${id}`)
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

  const completedMatches = matches
    .filter(m => m.status === 'complete' && m.winner_id)
    .reverse() // most recent first

  const isComplete = tournament.status === 'complete'

  return (
    <div
      className="fixed inset-0 bg-gray-900 text-white flex flex-col overflow-hidden"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800 shrink-0">
        <div>
          <span className="text-3xl font-black text-white tracking-tight">{tournament.name}</span>
          <span className="text-gray-500 text-base ml-4 font-medium">Results</span>
        </div>
        <div className="flex items-center gap-4">
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

      {/* ── Body ── */}
      {isComplete ? (
        <FinalStandings groups={groups} matches={matches} />
      ) : completedMatches.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-700 text-2xl">
          No results yet
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {completedMatches.map(m => (
            <ResultRow
              key={m.id}
              match={m}
              score={scores[m.id]}
              isNew={newMatchIds.has(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

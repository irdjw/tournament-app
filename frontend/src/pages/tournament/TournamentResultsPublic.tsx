import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  getTournamentFull,
  type Tournament,
  type TournamentGroup,
  type TournamentMatch,
} from '../../lib/tournaments'

const FOLLOWED_KEY = 'followedTournaments'

// ─── localStorage helpers ─────────────────────────────────────────────────────

function getFollowed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FOLLOWED_KEY) ?? '[]')
  } catch {
    return []
  }
}

function setFollowed(ids: string[]) {
  localStorage.setItem(FOLLOWED_KEY, JSON.stringify(ids))
}

// ─── Fetch scores for completed matches ───────────────────────────────────────

interface MatchScore {
  winnerLegs: number
  loserLegs: number
}

async function fetchScores(
  completedMatches: TournamentMatch[],
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
      result[tm.id] = { winnerLegs: winner.legs_won, loserLegs: loser.legs_won }
    }
  }
  return result
}

// ─── Share helper ─────────────────────────────────────────────────────────────

function share(title: string, text: string, url: string) {
  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {})
  } else {
    navigator.clipboard?.writeText(url)
  }
}

// ─── Result card ──────────────────────────────────────────────────────────────

function ResultCard({
  match,
  score,
}: {
  match: TournamentMatch
  score: MatchScore | undefined
}) {
  const winner = match.winner?.name ?? 'Unknown'
  const loser =
    match.winner_id === match.player_a_id
      ? match.player_b?.name ?? 'Unknown'
      : match.player_a?.name ?? 'Unknown'

  const roundLabel = match.group
    ? `${match.group.name} · Round ${match.round}`
    : `Round ${match.round}`

  const scoreStr = score ? `${score.winnerLegs}–${score.loserLegs}` : null

  const handleShare = () => {
    const text = scoreStr
      ? `${winner} beat ${loser} ${scoreStr} in ${roundLabel}`
      : `${winner} beat ${loser} in ${roundLabel}`
    share(winner + ' wins!', text, window.location.href)
  }

  return (
    <div className="bg-gray-800 rounded-2xl px-4 py-4 space-y-3">
      <div className="text-gray-500 text-xs font-medium uppercase tracking-wide">
        {roundLabel}
      </div>

      {/* Winner */}
      <div className="flex items-center gap-2">
        <span className="text-yellow-400 text-lg">🏆</span>
        <span className="text-white text-lg font-black leading-tight">{winner}</span>
        {scoreStr && (
          <span className="ml-auto text-amber-400 font-bold text-sm shrink-0">
            {scoreStr}
          </span>
        )}
      </div>

      {/* vs loser */}
      <div className="flex items-center gap-2">
        <span className="text-gray-600 text-sm font-medium w-5 text-center">def.</span>
        <span className="text-gray-400 text-base font-semibold">{loser}</span>
      </div>

      {/* Share */}
      <button
        onClick={handleShare}
        className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
      >
        <span>↗</span> Share result
      </button>
    </div>
  )
}

// ─── Final standings ──────────────────────────────────────────────────────────

function FinalStandings({
  groups,
  matches,
}: {
  groups: TournamentGroup[]
  matches: TournamentMatch[]
}) {
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
    <div className="bg-gray-800 rounded-2xl px-6 py-8 text-center space-y-4">
      <div className="text-amber-400 text-xs font-bold uppercase tracking-widest">
        🏆 Tournament Complete
      </div>
      {champion && (
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">
            Champion
          </div>
          <div className="text-white text-4xl font-black">{champion.name}</div>
        </div>
      )}
      {runnerUp && (
        <div>
          <div className="text-gray-600 text-xs uppercase tracking-widest mb-1">
            Runner-up
          </div>
          <div className="text-gray-400 text-2xl font-bold">{runnerUp.name}</div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TournamentResultsPublic() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [groups, setGroups] = useState<TournamentGroup[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [scores, setScores] = useState<Record<string, MatchScore>>({})
  const [loading, setLoading] = useState(true)
  const [followed, setFollowedState] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (id) setFollowedState(getFollowed().includes(id))
  }, [id])

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
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    channelRef.current = supabase
      .channel(`public-results-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, load)
      .subscribe()
    return () => { channelRef.current?.unsubscribe() }
  }, [id])

  const handleFollow = () => {
    if (!id) return
    const current = getFollowed()
    if (followed) {
      setFollowed(current.filter(t => t !== id))
      setFollowedState(false)
    } else {
      setFollowed([...current, id])
      setFollowedState(true)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-lg animate-pulse">Loading…</div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Tournament not found</div>
      </div>
    )
  }

  const completedMatches = matches
    .filter(m => m.status === 'complete' && m.winner_id)
    .slice()
    .reverse()

  const isComplete = tournament.status === 'complete'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* Header */}
        <div>
          <Link
            to={`/tournament/${id}`}
            className="text-gray-500 text-xs mb-1 block"
          >
            ← Back
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-black">{tournament.name}</h1>
              <div className="text-gray-500 text-xs">Results</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isComplete ? (
                <span className="text-xs bg-green-800 text-green-200 font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                  Complete
                </span>
              ) : (
                <span className="text-xs bg-amber-600 text-black font-bold px-2.5 py-1 rounded-full uppercase tracking-wide animate-pulse">
                  Live
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Follow button */}
        <button
          onClick={handleFollow}
          className={`w-full py-3 rounded-2xl font-bold text-sm transition-colors ${
            followed
              ? 'bg-green-800 text-green-200'
              : 'bg-gray-800 hover:bg-gray-700 text-white'
          }`}
        >
          {followed ? '✓ Following this tournament' : '🔔 Follow this tournament'}
        </button>

        {/* Body */}
        {isComplete ? (
          <FinalStandings groups={groups} matches={matches} />
        ) : completedMatches.length === 0 ? (
          <div className="text-center text-gray-600 py-12">No results yet</div>
        ) : null}

        {completedMatches.length > 0 && (
          <div className="space-y-3">
            {completedMatches.map(m => (
              <ResultCard key={m.id} match={m} score={scores[m.id]} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

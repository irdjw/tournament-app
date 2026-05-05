import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  getTournamentFull,
  type Tournament,
  type TournamentGroup,
  type TournamentMatch,
  type TournamentParticipant,
} from '../../lib/tournaments'

// ─── Derive player bracket status from match data ─────────────────────────────

function getPlayerStatus(
  userId: string,
  groups: TournamentGroup[],
  matches: TournamentMatch[],
  isComplete: boolean,
): string {
  const grandFinalGroup = groups.find(g => g.group_type === 'grand_final')
  const grandFinalMatch = grandFinalGroup
    ? matches.find(m => m.group_id === grandFinalGroup.id && m.status === 'complete')
    : matches.filter(m => m.status === 'complete').at(-1)

  if (isComplete && grandFinalMatch) {
    if (grandFinalMatch.winner_id === userId) return '🏆 Champion'
    const runnerUpId =
      grandFinalMatch.player_a_id === userId || grandFinalMatch.player_b_id === userId
        ? userId
        : null
    if (runnerUpId) return '🥈 Runner-up'
  }

  // Check if player is still active in winners or losers bracket
  const winnersGroup = groups.find(g => g.group_type === 'winners')
  const losersGroup = groups.find(g => g.group_type === 'losers')

  const isInWinners = matches.some(
    m =>
      m.group_id === winnersGroup?.id &&
      m.status !== 'complete' &&
      (m.player_a_id === userId || m.player_b_id === userId),
  )
  if (isInWinners) return '🟡 In Winners Bracket'

  const isInLosers = matches.some(
    m =>
      m.group_id === losersGroup?.id &&
      m.status !== 'complete' &&
      (m.player_a_id === userId || m.player_b_id === userId),
  )
  if (isInLosers) return '🔵 In Losers Bracket'

  // Single elimination — any pending match
  const hasActivePendingMatch = matches.some(
    m =>
      m.status !== 'complete' &&
      (m.player_a_id === userId || m.player_b_id === userId),
  )
  if (hasActivePendingMatch) return '🟡 Active'

  // Eliminated — lost a match and no further matches
  const hasLost = matches.some(
    m => m.status === 'complete' && m.loser_id === userId,
  )
  if (hasLost) return '❌ Eliminated'

  return '⏳ Pending'
}

// ─── Format helpers ───────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: 'Single Elimination',
  double_elimination: 'Double Elimination',
  group_stage: 'Group Stage',
}

const STATUS_LABELS: Record<string, string> = {
  setup: 'Setting Up',
  active: 'Live',
  complete: 'Complete',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TournamentOverview() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [groups, setGroups] = useState<TournamentGroup[]>([])
  const [participants, setParticipants] = useState<TournamentParticipant[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [sportName, setSportName] = useState('')
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const load = async () => {
    if (!id) return
    try {
      const data = await getTournamentFull(id)
      setTournament(data.tournament)
      setGroups(data.groups)
      setParticipants(data.participants)
      setMatches(data.matches)

      if (data.tournament.sport_id) {
        const { data: sport } = await supabase
          .from('sports')
          .select('name')
          .eq('id', data.tournament.sport_id)
          .single()
        if (sport) setSportName(sport.name)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    channelRef.current = supabase
      .channel(`public-overview-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, load)
      .subscribe()
    return () => { channelRef.current?.unsubscribe() }
  }, [id])

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
        <div className="text-gray-400 text-lg">Tournament not found</div>
      </div>
    )
  }

  const isComplete = tournament.status === 'complete'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="text-3xl">🏆</div>
          <h1 className="text-2xl font-black tracking-tight">{tournament.name}</h1>
          {sportName && (
            <div className="text-gray-400 text-sm">{sportName}</div>
          )}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
              {FORMAT_LABELS[tournament.format] ?? tournament.format}
            </span>
            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${
              isComplete
                ? 'bg-green-800 text-green-200'
                : tournament.status === 'active'
                ? 'bg-amber-600 text-black'
                : 'bg-gray-700 text-gray-300'
            }`}>
              {STATUS_LABELS[tournament.status] ?? tournament.status}
            </span>
          </div>
        </div>

        {/* Navigation links */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to={`/tournament/${id}/bracket`}
            className="flex flex-col items-center gap-1 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl p-4 text-center transition-colors"
          >
            <span className="text-2xl">📊</span>
            <span className="font-bold text-sm">View Bracket</span>
          </Link>
          <Link
            to={`/tournament/${id}/results`}
            className="flex flex-col items-center gap-1 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-2xl p-4 text-center transition-colors"
          >
            <span className="text-2xl">📋</span>
            <span className="font-bold text-sm">Results</span>
          </Link>
        </div>

        {/* Player list */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
            Players ({participants.length})
          </h2>
          <div className="space-y-2">
            {participants.map(p => {
              const status = getPlayerStatus(p.user_id, groups, matches, isComplete)
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3 gap-2"
                >
                  <span className="font-semibold text-white truncate">
                    {p.user?.name ?? '—'}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{status}</span>
                </div>
              )
            })}
            {participants.length === 0 && (
              <div className="text-center text-gray-600 py-6">No players yet</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

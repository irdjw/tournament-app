import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import {
  getTournamentFull,
  createMatchForTournamentSlot,
  recordTournamentMatchResult,
  generateKnockoutFromGroups,
  getActiveMatches,
  type Tournament,
  type TournamentGroup,
  type TournamentMatch,
  type TournamentParticipant,
} from '../../../lib/tournaments'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-gray-700 text-gray-300',
    in_progress: 'bg-amber-600 text-white',
    complete: 'bg-green-700 text-white',
  }
  const label: Record<string, string> = { pending: 'Pending', in_progress: 'In Progress', complete: 'Complete' }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${map[status] ?? 'bg-gray-700 text-gray-300'}`}>
      {label[status] ?? status}
    </span>
  )
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({
  match,
  tournament,
  onScore,
  onResultRecorded,
}: {
  match: TournamentMatch
  tournament: Tournament
  onScore: (match: TournamentMatch) => Promise<void>
  onResultRecorded: () => void
}) {
  const [scoring, setScoring] = useState(false)
  const navigate = useNavigate()

  const playerA = match.player_a?.name ?? 'TBD'
  const playerB = match.player_b?.name ?? 'TBD'
  const bothPlayersKnown = match.player_a_id && match.player_b_id
  const isComplete = match.status === 'complete'
  const winnerName = match.winner?.name

  const handleScore = async () => {
    if (scoring || !bothPlayersKnown) return
    setScoring(true)
    try {
      await onScore(match)
    } finally {
      setScoring(false)
    }
  }

  return (
    <div className={`bg-gray-800 border rounded-xl p-4 transition-colors ${
      isComplete ? 'border-green-800' :
      match.status === 'in_progress' ? 'border-amber-600' :
      'border-gray-700'
    }`}>
      {/* Group label */}
      {match.group && (
        <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
          {match.group.name} — Round {match.round}
        </div>
      )}

      {/* Players */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex-1 text-center py-2 px-3 rounded-lg text-base font-bold ${
          isComplete && match.winner_id === match.player_a_id
            ? 'bg-green-800 text-green-200'
            : 'bg-gray-700 text-white'
        }`}>
          {playerA}
        </div>
        <span className="text-gray-500 font-bold text-sm">vs</span>
        <div className={`flex-1 text-center py-2 px-3 rounded-lg text-base font-bold ${
          isComplete && match.winner_id === match.player_b_id
            ? 'bg-green-800 text-green-200'
            : 'bg-gray-700 text-white'
        }`}>
          {playerB}
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <StatusBadge status={match.status} />

        {isComplete ? (
          <span className="text-green-400 text-sm font-medium">
            {winnerName ? `🏆 ${winnerName}` : '✓ Done'}
          </span>
        ) : match.status === 'in_progress' && match.match_id ? (
          <Link
            to={`/bar/scoring/${match.match_id}?returnTo=/bar/tournament/${tournament.id}`}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm transition-colors"
          >
            Score →
          </Link>
        ) : bothPlayersKnown ? (
          <button
            onClick={handleScore}
            disabled={scoring}
            className="px-5 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white font-bold rounded-lg text-sm transition-colors"
          >
            {scoring ? '…' : 'Score'}
          </button>
        ) : (
          <span className="text-gray-600 text-sm">Waiting</span>
        )}
      </div>
    </div>
  )
}

// ─── Group Section ────────────────────────────────────────────────────────────

function GroupSection({
  group,
  matches,
  tournament,
  participants,
  onScore,
  onResultRecorded,
}: {
  group: TournamentGroup
  matches: TournamentMatch[]
  tournament: Tournament
  participants: TournamentParticipant[]
  onScore: (match: TournamentMatch) => Promise<void>
  onResultRecorded: () => void
}) {
  const groupMatches = matches.filter(m => m.group_id === group.id)
  const activeMatches = groupMatches.filter(m => m.player_a_id && m.player_b_id && m.status !== 'complete')
  const completedMatches = groupMatches.filter(m => m.status === 'complete')
  const allDone = groupMatches.length > 0 && activeMatches.length === 0

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-white">{group.name}</h2>
        <div className="text-sm text-gray-500">
          {completedMatches.length}/{groupMatches.filter(m => m.player_a_id && m.player_b_id).length} done
        </div>
      </div>

      {allDone && (
        <div className="mb-3 p-3 bg-green-900/40 border border-green-700 rounded-lg text-green-300 text-sm font-medium">
          ✓ All matches complete
        </div>
      )}

      <div className="space-y-3">
        {activeMatches.map(m => (
          <MatchCard key={m.id} match={m} tournament={tournament} onScore={onScore} onResultRecorded={onResultRecorded} />
        ))}
        {completedMatches.map(m => (
          <MatchCard key={m.id} match={m} tournament={tournament} onScore={onScore} onResultRecorded={onResultRecorded} />
        ))}
        {groupMatches.filter(m => !m.player_a_id || !m.player_b_id).map(m => (
          <MatchCard key={m.id} match={m} tournament={tournament} onScore={onScore} onResultRecorded={onResultRecorded} />
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TournamentControl() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [groups, setGroups] = useState<TournamentGroup[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [participants, setParticipants] = useState<TournamentParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const load = async () => {
    if (!id) return
    try {
      const data = await getTournamentFull(id)
      setTournament(data.tournament)
      setGroups(data.groups)
      setMatches(data.matches)
      setParticipants(data.participants)
      // Check for completed matches that need result propagation
      await syncCompletedMatches(data.matches)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // When a match record completes in DB, propagate result to tournament_match
  const syncCompletedMatches = async (currentMatches: TournamentMatch[]) => {
    const inProgressMatches = currentMatches.filter(m => m.status === 'in_progress' && m.match_id)
    if (inProgressMatches.length === 0) return

    for (const tm of inProgressMatches) {
      const { data: matchData } = await supabase
        .from('matches')
        .select('status')
        .eq('id', tm.match_id!)
        .single()

      if (matchData?.status === 'complete') {
        // Get match players to determine winner
        const { data: players } = await supabase
          .from('match_players')
          .select('user_id, legs_won')
          .eq('match_id', tm.match_id!)
          .order('legs_won', { ascending: false })

        if (players && players.length === 2) {
          const winner = players[0].user_id
          const loser = players[1].user_id
          await recordTournamentMatchResult(tm.id, winner, loser)
        }
      }
    }
  }

  useEffect(() => {
    load()
    // Subscribe to changes
    channelRef.current = supabase
      .channel(`tournament-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, () => {
        load()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => {
        load()
      })
      .subscribe()
    return () => { channelRef.current?.unsubscribe() }
  }, [id])

  const handleScore = async (match: TournamentMatch) => {
    if (!tournament) return
    if (match.match_id) {
      // Already has a match record, just navigate
      navigate(`/bar/scoring/${match.match_id}?returnTo=/bar/tournament/${id}`)
      return
    }
    // Create the match record
    const { data: tournamentData } = await supabase.from('tournaments').select('sport_id, venue_id, config').eq('id', tournament.id).single()
    if (!tournamentData) return
    const matchId = await createMatchForTournamentSlot(
      match.id,
      tournamentData.sport_id,
      tournamentData.venue_id,
      tournament.config,
      match.player_a_id!,
      match.player_b_id!,
    )
    navigate(`/bar/scoring/${matchId}?returnTo=/bar/tournament/${id}`)
  }

  const handleGenerateBrackets = async () => {
    if (!id) return
    setGenerating(true)
    setError('')
    try {
      await generateKnockoutFromGroups(id, 2)
      await load()
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to generate brackets')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading tournament…</div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Tournament not found</div>
      </div>
    )
  }

  const isGroupStage = tournament.format === 'group_stage'
  const groupGroups = groups.filter(g => g.group_type === 'group')
  const knockoutGroups = groups.filter(g => g.group_type === 'winners' || g.group_type === 'grand_final' || g.group_type === 'losers')

  const groupStageComplete = isGroupStage && groupGroups.length > 0 && groupGroups.every(g => {
    const gMatches = matches.filter(m => m.group_id === g.id)
    return gMatches.length > 0 && gMatches.every(m => m.status === 'complete')
  })

  const hasKnockout = knockoutGroups.length > 0

  const activeMatches = getActiveMatches(matches)

  const formatLabel: Record<string, string> = {
    single_elimination: 'Single Elimination',
    double_elimination: 'Double Elimination',
    group_stage: 'Group Stage',
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{tournament.name}</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {formatLabel[tournament.format] ?? tournament.format} ·{' '}
              {participants.length} players ·{' '}
              <span className={tournament.status === 'active' ? 'text-green-400' : 'text-gray-400'}>
                {tournament.status}
              </span>
            </p>
          </div>
          <Link
            to={`/bar/tournament/${id}/bracket`}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            View Bracket →
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-500 rounded-lg text-red-200 text-sm">{error}</div>
        )}

        {/* Active now banner */}
        {activeMatches.length > 0 && (
          <div className="mb-6 p-4 bg-amber-900/30 border border-amber-600 rounded-xl">
            <div className="text-amber-400 font-bold text-sm mb-1">⚡ Active Now</div>
            <div className="text-white text-sm">
              {activeMatches.length} match{activeMatches.length !== 1 ? 'es' : ''} in progress
            </div>
          </div>
        )}

        {/* Group stage groups */}
        {isGroupStage && groupGroups.length > 0 && (
          <div>
            <h2 className="text-amber-400 font-bold text-base uppercase tracking-wide mb-4">Group Stage</h2>
            {groupGroups.map(g => (
              <GroupSection
                key={g.id}
                group={g}
                matches={matches}
                tournament={tournament}
                participants={participants}
                onScore={handleScore}
                onResultRecorded={load}
              />
            ))}
          </div>
        )}

        {/* Generate brackets button (after group stage) */}
        {isGroupStage && groupStageComplete && !hasKnockout && (
          <div className="mb-8">
            <div className="p-4 bg-green-900/30 border border-green-700 rounded-xl mb-4">
              <div className="text-green-300 font-bold">✓ Group Stage Complete</div>
              <div className="text-green-400 text-sm mt-1">Top 2 from each group will advance to the knockout bracket.</div>
            </div>
            <button
              onClick={handleGenerateBrackets}
              disabled={generating}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 text-black disabled:text-gray-500 text-lg font-bold rounded-xl transition-colors"
            >
              {generating ? 'Generating…' : '🏆 Generate Knockout Bracket'}
            </button>
          </div>
        )}

        {/* Knockout / Bracket groups */}
        {knockoutGroups.length > 0 && (
          <div>
            <h2 className="text-amber-400 font-bold text-base uppercase tracking-wide mb-4">
              {isGroupStage ? 'Knockout Stage' : 'Bracket'}
            </h2>
            {knockoutGroups.map(g => (
              <GroupSection
                key={g.id}
                group={g}
                matches={matches}
                tournament={tournament}
                participants={participants}
                onScore={handleScore}
                onResultRecorded={load}
              />
            ))}
          </div>
        )}

        {/* Single / Double elim with no groups yet */}
        {!isGroupStage && groups.length === 0 && (
          <div className="text-center py-12 text-gray-500">No bracket generated yet.</div>
        )}

        {/* Footer actions */}
        <div className="mt-8 pt-6 border-t border-gray-800 flex gap-3">
          <Link
            to="/bar/tournament/new"
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Tournament
          </Link>
        </div>
      </div>
    </div>
  )
}

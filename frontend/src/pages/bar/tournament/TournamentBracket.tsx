import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import BarNav from '../../../components/BarNav'
import {
  getTournamentFull,
  type Tournament,
  type TournamentGroup,
  type TournamentMatch,
} from '../../../lib/tournaments'
import { supabase } from '../../../lib/supabase'

// ─── Match Cell ───────────────────────────────────────────────────────────────

function MatchCell({ match, isCurrent }: { match: TournamentMatch; isCurrent: boolean }) {
  const playerA = match.player_a?.name ?? 'TBD'
  const playerB = match.player_b?.name ?? 'TBD'
  const isComplete = match.status === 'complete'
  const hasPlayers = match.player_a_id || match.player_b_id

  return (
    <div className={`rounded-xl border-2 overflow-hidden text-sm transition-colors ${
      isCurrent ? 'border-amber-500 shadow-lg shadow-amber-500/20' :
      isComplete ? 'border-green-800' :
      'border-gray-700'
    }`}>
      {/* Round label */}
      <div className={`px-3 py-1 text-xs font-bold uppercase tracking-wider ${
        isCurrent ? 'bg-amber-600 text-black' :
        isComplete ? 'bg-green-900 text-green-300' :
        'bg-gray-800 text-gray-500'
      }`}>
        {isComplete ? '✓ Complete' : isCurrent ? '▶ Active' : hasPlayers ? 'Pending' : 'TBD'}
      </div>

      {/* Player A */}
      <div className={`flex items-center px-3 py-2.5 border-b border-gray-700 ${
        isComplete && match.winner_id === match.player_a_id ? 'bg-green-900/40' : 'bg-gray-800'
      }`}>
        <span className={`flex-1 font-medium ${
          !match.player_a_id ? 'text-gray-600 italic' :
          isComplete && match.winner_id === match.player_a_id ? 'text-green-300' :
          isComplete ? 'text-gray-500' : 'text-white'
        }`}>
          {playerA}
        </span>
        {isComplete && match.winner_id === match.player_a_id && (
          <span className="text-green-400 text-xs font-bold ml-2">🏆</span>
        )}
      </div>

      {/* Player B */}
      <div className={`flex items-center px-3 py-2.5 ${
        isComplete && match.winner_id === match.player_b_id ? 'bg-green-900/40' : 'bg-gray-800'
      }`}>
        <span className={`flex-1 font-medium ${
          !match.player_b_id ? 'text-gray-600 italic' :
          isComplete && match.winner_id === match.player_b_id ? 'text-green-300' :
          isComplete ? 'text-gray-500' : 'text-white'
        }`}>
          {playerB}
        </span>
        {isComplete && match.winner_id === match.player_b_id && (
          <span className="text-green-400 text-xs font-bold ml-2">🏆</span>
        )}
      </div>
    </div>
  )
}

// ─── Bracket Column ───────────────────────────────────────────────────────────

function BracketColumn({
  group,
  matches,
  label,
  accentColor,
}: {
  group: TournamentGroup
  matches: TournamentMatch[]
  label: string
  accentColor: string
}) {
  const groupMatches = matches.filter(m => m.group_id === group.id)

  // Group by round
  const rounds = new Map<number, TournamentMatch[]>()
  for (const m of groupMatches) {
    if (!rounds.has(m.round)) rounds.set(m.round, [])
    rounds.get(m.round)!.push(m)
  }
  const sortedRounds = [...rounds.entries()].sort((a, b) => a[0] - b[0])

  // Determine which matches are currently active (have both players, not complete)
  const currentMatchIds = new Set(
    groupMatches
      .filter(m => m.player_a_id && m.player_b_id && m.status !== 'complete')
      .map(m => m.id)
  )

  const roundLabel = (r: number, totalRounds: number): string => {
    const remaining = totalRounds - r + 1
    if (remaining === 1) return 'Final'
    if (remaining === 2) return 'Semi-Final'
    if (remaining === 3) return 'Quarter-Final'
    return `Round ${r}`
  }

  if (sortedRounds.length === 0) {
    return (
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-bold uppercase tracking-wider mb-3 ${accentColor}`}>{label}</div>
        <div className="text-gray-600 text-sm text-center py-8">No matches yet</div>
      </div>
    )
  }

  const totalRounds = Math.max(...sortedRounds.map(([r]) => r))

  return (
    <div className="flex-1 min-w-0">
      <div className={`text-xs font-bold uppercase tracking-wider mb-3 ${accentColor}`}>{label}</div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {sortedRounds.map(([round, roundMatches]) => (
          <div key={round} className="flex-shrink-0" style={{ minWidth: '180px' }}>
            <div className="text-xs text-gray-500 font-medium mb-2 text-center">
              {roundLabel(round, totalRounds)}
            </div>
            <div className="space-y-3">
              {roundMatches
                .sort((a, b) => a.position - b.position)
                .map(m => (
                  <MatchCell key={m.id} match={m} isCurrent={currentMatchIds.has(m.id)} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Grand Final ──────────────────────────────────────────────────────────────

function GrandFinalSection({ match }: { match: TournamentMatch }) {
  const isActive = match.player_a_id && match.player_b_id && match.status !== 'complete'
  const isComplete = match.status === 'complete'

  return (
    <div className="mt-8 border-t border-gray-700 pt-6">
      <div className="text-center text-amber-400 font-bold text-sm uppercase tracking-wider mb-4">
        🏆 Grand Final
      </div>
      <div className="max-w-sm mx-auto">
        <MatchCell match={match} isCurrent={!!isActive} />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TournamentBracket() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [groups, setGroups] = useState<TournamentGroup[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    if (!id) return
    try {
      const data = await getTournamentFull(id)
      setTournament(data.tournament)
      setGroups(data.groups)
      setMatches(data.matches)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`bracket-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, load)
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading bracket…</div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Tournament not found</div>
      </div>
    )
  }

  const winnersGroup = groups.find(g => g.group_type === 'winners')
  const losersGroup = groups.find(g => g.group_type === 'losers')
  const grandFinalGroup = groups.find(g => g.group_type === 'grand_final')
  const grandFinalMatch = grandFinalGroup ? matches.find(m => m.group_id === grandFinalGroup.id) : null

  // Show side-by-side whenever both brackets exist (double_elimination or group_stage parallel brackets)
  const showBothBrackets = !!(winnersGroup && losersGroup)

  const formatLabel: Record<string, string> = {
    single_elimination: 'Single Elimination',
    double_elimination: 'Double Elimination',
    group_stage: 'Group Stage',
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <BarNav />
      <div className="px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 max-w-6xl mx-auto">
          <div>
            <Link
              to={`/bar/tournament/${id}`}
              className="text-gray-400 hover:text-white text-sm mb-1 block transition-colors"
            >
              ← Back to Control
            </Link>
            <h1 className="text-2xl font-bold text-white">{tournament.name}</h1>
            <p className="text-gray-400 text-sm">{formatLabel[tournament.format]} · Bracket View</p>
          </div>
          <div className="text-xs text-gray-600">
            Live · auto-updates
          </div>
        </div>

        {error && (
          <div className="max-w-6xl mx-auto mb-4 p-3 bg-red-900 border border-red-500 rounded-lg text-red-200 text-sm">{error}</div>
        )}

        {/* Legend */}
        <div className="max-w-6xl mx-auto mb-6 flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border-2 border-amber-500 inline-block" /> Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border-2 border-green-700 inline-block" /> Complete
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border-2 border-gray-700 inline-block" /> Pending
          </span>
        </div>

        {/* Bracket content */}
        <div className="max-w-6xl mx-auto">

          {/* Side-by-side when both brackets exist (double elim or group_stage parallel) */}
          {showBothBrackets ? (
            <div>
              <div className="flex gap-8">
                {winnersGroup && (
                  <BracketColumn
                    group={winnersGroup}
                    matches={matches}
                    label="Winners Bracket"
                    accentColor="text-amber-400"
                  />
                )}
                {losersGroup && (
                  <BracketColumn
                    group={losersGroup}
                    matches={matches}
                    label="Losers Bracket"
                    accentColor="text-blue-400"
                  />
                )}
              </div>
              {grandFinalMatch && <GrandFinalSection match={grandFinalMatch} />}
            </div>
          ) : winnersGroup ? (
            /* Single bracket */
            <BracketColumn
              group={winnersGroup}
              matches={matches}
              label="Bracket"
              accentColor="text-amber-400"
            />
          ) : (
            <div className="text-center py-16 text-gray-600">
              <div className="text-4xl mb-4">🏆</div>
              <div className="text-lg">Bracket not yet generated</div>
              {tournament.format === 'group_stage' && (
                <div className="text-sm mt-2">Complete the group stage to generate the knockout bracket</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

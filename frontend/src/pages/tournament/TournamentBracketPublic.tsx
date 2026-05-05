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

const MY_PLAYER_KEY = 'myPlayerId'

// ─── Identify-yourself modal ──────────────────────────────────────────────────

function IdentifyModal({
  participants,
  onSelect,
  onClose,
}: {
  participants: TournamentParticipant[]
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-t-2xl w-full max-w-lg p-5 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-center">Who are you?</h2>
        <p className="text-gray-400 text-sm text-center">
          We'll highlight your matches
        </p>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {participants.map(p => (
            <button
              key={p.id}
              className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-3 font-semibold transition-colors"
              onClick={() => onSelect(p.user_id)}
            >
              {p.user?.name ?? '—'}
            </button>
          ))}
        </div>
        <button
          className="w-full text-gray-500 text-sm py-2"
          onClick={onClose}
        >
          Skip
        </button>
      </div>
    </div>
  )
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({
  match,
  myPlayerId,
}: {
  match: TournamentMatch
  myPlayerId: string | null
}) {
  const isComplete = match.status === 'complete'
  const isCurrent = !isComplete && !!(match.player_a_id && match.player_b_id)
  const isMyMatch =
    !!myPlayerId &&
    (match.player_a_id === myPlayerId || match.player_b_id === myPlayerId)

  const playerRow = (
    playerId: string | null | undefined,
    name: string | undefined | null,
  ) => {
    const isWinner = isComplete && match.winner_id === playerId
    const isMe = !!myPlayerId && playerId === myPlayerId
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2.5 border-b border-gray-700/60 last:border-0 ${
          isWinner ? 'bg-green-900/30' : 'bg-gray-800'
        }`}
      >
        <span
          className={`flex-1 truncate text-sm leading-tight ${
            !name
              ? 'text-gray-600 italic'
              : isWinner
              ? 'text-green-300 font-black'
              : isMe
              ? 'text-amber-300 font-bold'
              : isComplete
              ? 'text-gray-500 font-medium'
              : 'text-white font-semibold'
          }`}
        >
          {name ?? 'TBD'}
          {isMe && !isComplete && (
            <span className="ml-1 text-xs text-amber-400">(you)</span>
          )}
        </span>
        {isWinner && <span className="text-yellow-400 text-xs shrink-0">🏆</span>}
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden min-w-[160px] max-w-[200px] transition-all ${
        isMyMatch && !isComplete
          ? 'border-amber-400 shadow-lg shadow-amber-400/20'
          : isCurrent
          ? 'border-amber-700'
          : isComplete
          ? 'border-green-800'
          : 'border-gray-700'
      }`}
    >
      {/* status bar */}
      <div
        className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
          isMyMatch && !isComplete
            ? 'bg-amber-500 text-black'
            : isCurrent
            ? 'bg-amber-800 text-amber-200'
            : isComplete
            ? 'bg-green-900 text-green-400'
            : 'bg-gray-800 text-gray-600'
        }`}
      >
        {isMyMatch && !isComplete
          ? '⭐ Your Match'
          : isCurrent
          ? '▶ Active'
          : isComplete
          ? '✓ Done'
          : 'Pending'}
      </div>
      {playerRow(match.player_a_id, match.player_a?.name)}
      {playerRow(match.player_b_id, match.player_b?.name)}
    </div>
  )
}

// ─── Round column ─────────────────────────────────────────────────────────────

function RoundCol({
  label,
  roundMatches,
  myPlayerId,
}: {
  label: string
  roundMatches: TournamentMatch[]
  myPlayerId: string | null
}) {
  return (
    <div className="flex flex-col gap-3 flex-shrink-0" style={{ minWidth: 170 }}>
      <div className="text-center text-gray-500 text-[10px] font-bold uppercase tracking-widest pb-2 border-b border-gray-800">
        {label}
      </div>
      {roundMatches
        .slice()
        .sort((a, b) => a.position - b.position)
        .map(m => (
          <MatchCard key={m.id} match={m} myPlayerId={myPlayerId} />
        ))}
    </div>
  )
}

// ─── Bracket section ──────────────────────────────────────────────────────────

function BracketSection({
  label,
  accentColor,
  group,
  matches,
  myPlayerId,
}: {
  label: string
  accentColor: string
  group: TournamentGroup | undefined
  matches: TournamentMatch[]
  myPlayerId: string | null
}) {
  if (!group) return null

  const groupMatches = matches.filter(m => m.group_id === group.id)
  const roundsMap = new Map<number, TournamentMatch[]>()
  for (const m of groupMatches) {
    if (!roundsMap.has(m.round)) roundsMap.set(m.round, [])
    roundsMap.get(m.round)!.push(m)
  }
  const sortedRounds = [...roundsMap.entries()].sort((a, b) => a[0] - b[0])
  const totalRounds = sortedRounds.length

  const roundLabel = (r: number): string => {
    const idx = sortedRounds.findIndex(([rr]) => rr === r)
    const remaining = totalRounds - idx
    if (remaining === 1) return 'Final'
    if (remaining === 2) return 'Semi'
    if (remaining === 3) return 'Quarter'
    return `Rd ${r}`
  }

  return (
    <div className="space-y-3">
      <div className={`text-xs font-bold uppercase tracking-widest ${accentColor}`}>
        {label}
      </div>
      {/* Horizontal scroll — don't shrink, scroll instead */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {sortedRounds.map(([round, roundMatches]) => (
            <RoundCol
              key={round}
              label={roundLabel(round)}
              roundMatches={roundMatches}
              myPlayerId={myPlayerId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TournamentBracketPublic() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [groups, setGroups] = useState<TournamentGroup[]>([])
  const [participants, setParticipants] = useState<TournamentParticipant[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [showIdentify, setShowIdentify] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Load identity from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(MY_PLAYER_KEY)
    if (stored) setMyPlayerId(stored)
  }, [])

  const handleSelectPlayer = (userId: string) => {
    setMyPlayerId(userId)
    localStorage.setItem(MY_PLAYER_KEY, userId)
    setShowIdentify(false)
  }

  const load = async () => {
    if (!id) return
    try {
      const data = await getTournamentFull(id)
      setTournament(data.tournament)
      setGroups(data.groups)
      setParticipants(data.participants)
      setMatches(data.matches)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    channelRef.current = supabase
      .channel(`public-bracket-${id}`)
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
        <div className="text-gray-400">Tournament not found</div>
      </div>
    )
  }

  const isDoubleElim = tournament.format === 'double_elimination'
  const winnersGroup = groups.find(g => g.group_type === 'winners')
  const losersGroup = groups.find(g => g.group_type === 'losers')
  const grandFinalGroup = groups.find(g => g.group_type === 'grand_final')
  const grandFinalMatches = grandFinalGroup
    ? matches.filter(m => m.group_id === grandFinalGroup.id)
    : []

  // "My next match" — earliest non-complete match involving me
  const myNextMatch =
    myPlayerId
      ? matches
          .filter(
            m =>
              m.status !== 'complete' &&
              (m.player_a_id === myPlayerId || m.player_b_id === myPlayerId),
          )
          .sort((a, b) => a.round - b.round)[0] ?? null
      : null

  const myName = participants.find(p => p.user_id === myPlayerId)?.user?.name

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {showIdentify && (
        <IdentifyModal
          participants={participants}
          onSelect={handleSelectPlayer}
          onClose={() => setShowIdentify(false)}
        />
      )}

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              to={`/tournament/${id}`}
              className="text-gray-500 text-xs mb-1 block"
            >
              ← Back
            </Link>
            <h1 className="text-xl font-black">{tournament.name}</h1>
            <div className="text-gray-500 text-xs">Bracket View</div>
          </div>
          <button
            onClick={() => setShowIdentify(true)}
            className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-xl transition-colors"
          >
            {myName ? `👤 ${myName}` : 'Identify me'}
          </button>
        </div>

        {/* My next match banner */}
        {myNextMatch && (
          <div className="bg-amber-900/40 border-2 border-amber-500 rounded-2xl px-4 py-3 space-y-1">
            <div className="text-amber-400 text-xs font-bold uppercase tracking-widest">
              ⭐ Your Next Match
            </div>
            <div className="text-white font-bold">
              {myNextMatch.player_a?.name ?? 'TBD'} vs {myNextMatch.player_b?.name ?? 'TBD'}
            </div>
            <div className="text-gray-400 text-xs">
              {myNextMatch.group?.name
                ? `${myNextMatch.group.name} · Round ${myNextMatch.round}`
                : `Round ${myNextMatch.round}`}
              {myNextMatch.station && ` · Board ${myNextMatch.station}`}
            </div>
          </div>
        )}

        {/* Winners bracket */}
        <BracketSection
          label="Winners Bracket"
          accentColor="text-amber-400"
          group={winnersGroup}
          matches={matches}
          myPlayerId={myPlayerId}
        />

        {/* Losers bracket (double elim only) */}
        {isDoubleElim && (
          <BracketSection
            label="Losers Bracket"
            accentColor="text-blue-400"
            group={losersGroup}
            matches={matches}
            myPlayerId={myPlayerId}
          />
        )}

        {/* Grand final */}
        {isDoubleElim && grandFinalMatches.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest text-yellow-400">
              🏆 Grand Final
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {grandFinalMatches.map(m => (
                <MatchCard key={m.id} match={m} myPlayerId={myPlayerId} />
              ))}
            </div>
          </div>
        )}

        {/* Group stage — show all groups */}
        {!winnersGroup && groups.filter(g => g.group_type === 'group').length > 0 && (
          <>
            {groups
              .filter(g => g.group_type === 'group')
              .map(g => (
                <BracketSection
                  key={g.id}
                  label={g.name}
                  accentColor="text-green-400"
                  group={g}
                  matches={matches}
                  myPlayerId={myPlayerId}
                />
              ))}
          </>
        )}

        {groups.length === 0 && (
          <div className="text-center text-gray-600 py-12">
            Bracket not generated yet
          </div>
        )}

      </div>
    </div>
  )
}

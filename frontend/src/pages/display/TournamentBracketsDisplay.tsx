import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  getTournamentFull,
  type Tournament,
  type TournamentGroup,
  type TournamentMatch,
} from '../../lib/tournaments'

// ─── Match Slot ───────────────────────────────────────────────────────────────

function MatchSlot({ match }: { match: TournamentMatch }) {
  const playerA = match.player_a?.name
  const playerB = match.player_b?.name
  const isComplete = match.status === 'complete'
  const isCurrent = !isComplete && !!(match.player_a_id && match.player_b_id)
  const isTbd = !match.player_a_id && !match.player_b_id

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all ${
      isCurrent
        ? 'border-amber-500 shadow-lg shadow-amber-500/20'
        : isComplete
        ? 'border-green-800'
        : 'border-gray-700'
    }`}>
      {/* Status bar */}
      <div className={`px-3 py-1.5 text-xs font-black uppercase tracking-widest ${
        isCurrent ? 'bg-amber-600 text-black' :
        isComplete ? 'bg-green-900 text-green-300' :
        'bg-gray-800 text-gray-600'
      }`}>
        {isCurrent ? '▶ Active' : isComplete ? '✓ Complete' : isTbd ? 'TBD' : 'Pending'}
      </div>

      {/* Player A */}
      <div className={`flex items-center gap-2 px-4 py-3 border-b border-gray-700/60 ${
        isComplete && match.winner_id === match.player_a_id ? 'bg-green-900/30' : 'bg-gray-800'
      }`}>
        <span className={`flex-1 font-bold text-lg leading-tight truncate ${
          !playerA ? 'text-gray-600 italic font-normal text-base' :
          isComplete && match.winner_id === match.player_a_id ? 'text-green-300' :
          isComplete ? 'text-gray-500' :
          isCurrent ? 'text-white' : 'text-gray-200'
        }`}>
          {playerA ?? 'TBD'}
        </span>
        {isComplete && match.winner_id === match.player_a_id && (
          <span className="text-yellow-400 text-base shrink-0">🏆</span>
        )}
      </div>

      {/* Player B */}
      <div className={`flex items-center gap-2 px-4 py-3 ${
        isComplete && match.winner_id === match.player_b_id ? 'bg-green-900/30' : 'bg-gray-800'
      }`}>
        <span className={`flex-1 font-bold text-lg leading-tight truncate ${
          !playerB ? 'text-gray-600 italic font-normal text-base' :
          isComplete && match.winner_id === match.player_b_id ? 'text-green-300' :
          isComplete ? 'text-gray-500' :
          isCurrent ? 'text-white' : 'text-gray-200'
        }`}>
          {playerB ?? 'TBD'}
        </span>
        {isComplete && match.winner_id === match.player_b_id && (
          <span className="text-yellow-400 text-base shrink-0">🏆</span>
        )}
      </div>
    </div>
  )
}

// ─── Round column ─────────────────────────────────────────────────────────────

function RoundColumn({
  label,
  roundMatches,
}: {
  label: string
  roundMatches: TournamentMatch[]
}) {
  return (
    <div className="flex-shrink-0 flex flex-col gap-2" style={{ minWidth: '200px' }}>
      <div className="text-center text-gray-500 text-xs font-bold uppercase tracking-widest mb-1 pb-2 border-b border-gray-800">
        {label}
      </div>
      <div className="flex flex-col gap-3">
        {roundMatches
          .slice()
          .sort((a, b) => a.position - b.position)
          .map(m => (
            <MatchSlot key={m.id} match={m} />
          ))}
      </div>
    </div>
  )
}

// ─── Bracket Panel ────────────────────────────────────────────────────────────

function BracketPanel({
  group,
  matches,
  accentColor,
  scrollRef,
}: {
  group: TournamentGroup | undefined
  matches: TournamentMatch[]
  accentColor: string
  scrollRef: React.RefObject<HTMLDivElement>
}) {
  const labelMap: Record<string, string> = {
    winners: 'Winners Bracket',
    losers: 'Losers Bracket',
    grand_final: 'Grand Final',
  }

  if (!group) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-700 text-xl px-8 border-r border-gray-800 last:border-0">
        Not generated yet
      </div>
    )
  }

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
    if (remaining === 2) return 'Semi-Final'
    if (remaining === 3) return 'Quarter-Final'
    return `Round ${r}`
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800 last:border-0">
      {/* Panel header */}
      <div className="px-6 py-4 border-b border-gray-800 shrink-0">
        <div className={`text-sm font-black uppercase tracking-widest ${accentColor}`}>
          {labelMap[group.group_type] ?? group.name}
        </div>
      </div>

      {/* Scrollable rounds */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-auto px-6 py-5"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="flex gap-5 min-w-max">
          {sortedRounds.map(([round, roundMatches]) => (
            <RoundColumn
              key={round}
              label={roundLabel(round)}
              roundMatches={roundMatches}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Grand Final ──────────────────────────────────────────────────────────────

function GrandFinal({ match }: { match: TournamentMatch | undefined }) {
  if (!match) return null

  return (
    <div className="shrink-0 border-t border-gray-800 px-8 py-5 flex flex-col items-center gap-3">
      <div className="text-amber-400 text-xs font-black uppercase tracking-widest">🏆 Grand Final</div>
      <div className="w-full max-w-xs">
        <MatchSlot match={match} />
      </div>
    </div>
  )
}

// ─── Auto-scroll hook ─────────────────────────────────────────────────────────

function useAutoScroll(ref: React.RefObject<HTMLDivElement>, deps: unknown[]) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const totalHeight = el.scrollHeight - el.clientHeight
    if (totalHeight <= 0) return

    let pos = 0
    let direction = 1
    const speed = 0.4 // px per frame

    let rafId: number
    const tick = () => {
      pos += speed * direction
      if (pos >= totalHeight) { pos = totalHeight; direction = -1 }
      if (pos <= 0) { pos = 0; direction = 1 }
      el.scrollTop = pos
      rafId = requestAnimationFrame(tick)
    }
    const timeout = setTimeout(() => { rafId = requestAnimationFrame(tick) }, 3000)
    return () => { clearTimeout(timeout); cancelAnimationFrame(rafId) }
    // deps is intentionally caller-controlled so the scroll resets when match data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TournamentBracketsDisplay() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [groups, setGroups] = useState<TournamentGroup[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const winnersScrollRef = useRef<HTMLDivElement>(null)
  const losersScrollRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    if (!id) return
    try {
      const data = await getTournamentFull(id)
      setTournament(data.tournament)
      setGroups(data.groups)
      setMatches(data.matches)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    channelRef.current = supabase
      .channel(`tv-brackets-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, load)
      .subscribe()
    return () => { channelRef.current?.unsubscribe() }
  }, [id])

  useAutoScroll(winnersScrollRef, [matches])
  useAutoScroll(losersScrollRef, [matches])

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

  const isDoubleElim = tournament.format === 'double_elimination'
  const winnersGroup = groups.find(g => g.group_type === 'winners')
  const losersGroup = groups.find(g => g.group_type === 'losers')
  const grandFinalGroup = groups.find(g => g.group_type === 'grand_final')
  const grandFinalMatch = grandFinalGroup ? matches.find(m => m.group_id === grandFinalGroup.id) : undefined

  const singleGroup = !isDoubleElim ? winnersGroup : undefined

  return (
    <div
      className="fixed inset-0 bg-gray-900 text-white flex flex-col overflow-hidden"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800 shrink-0">
        <div>
          <span className="text-3xl font-black text-white tracking-tight">{tournament.name}</span>
          <span className="text-gray-500 text-base ml-4 font-medium">Bracket View</span>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-4 text-sm text-gray-600">
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
          <Clock />
        </div>
      </div>

      {/* ── Bracket panels ── */}
      <div className="flex-1 flex min-h-0">
        {isDoubleElim ? (
          <>
            <BracketPanel
              group={winnersGroup}
              matches={matches}
              accentColor="text-amber-400"
              scrollRef={winnersScrollRef}
            />
            <BracketPanel
              group={losersGroup}
              matches={matches}
              accentColor="text-blue-400"
              scrollRef={losersScrollRef}
            />
          </>
        ) : (
          <BracketPanel
            group={singleGroup}
            matches={matches}
            accentColor="text-amber-400"
            scrollRef={winnersScrollRef}
          />
        )}
      </div>

      {/* ── Grand Final ── */}
      {isDoubleElim && grandFinalMatch && (
        <GrandFinal match={grandFinalMatch} />
      )}
    </div>
  )
}

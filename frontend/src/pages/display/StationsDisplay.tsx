import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Station, StationPlayer, getAllStations, getStationsForVenue, getScoresForMatch } from '../../lib/stations'

const CARDS_PER_PAGE = 4
const CYCLE_MS = 10_000

// ─── Score hook for a single active match ─────────────────────────────────────

function useMatchScores(matchId: string, currentLeg: number, players: StationPlayer[]) {
  const [scores, setScores] = useState<Record<string, number>>({})

  useEffect(() => {
    getScoresForMatch(matchId, currentLeg, players).then(setScores)

    const sub = supabase
      .channel(`tv-scores-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'match_events',
        filter: `match_id=eq.${matchId}`,
      }, () => {
        getScoresForMatch(matchId, currentLeg, players).then(setScores)
      })
      .subscribe()

    return () => { sub.unsubscribe() }
  }, [matchId, currentLeg])

  return scores
}

// ─── Single station tile ──────────────────────────────────────────────────────

function StationTile({ station, totalVisible }: { station: Station; totalVisible: number }) {
  const match = station.current_match
  const players = match?.match_players ?? []
  const scores = useMatchScores(match?.id ?? '', match?.current_leg ?? 1, players)

  const teamA = players.find(p => p.team_id === 'team_a')
  const teamB = players.find(p => p.team_id === 'team_b')

  const scoreSize = totalVisible <= 2 ? 'text-8xl' : 'text-6xl'
  const nameSize  = totalVisible <= 2 ? 'text-2xl'  : 'text-xl'

  return (
    <div className="flex flex-col bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
      {/* Station header */}
      <div className="px-6 pt-5 pb-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm font-medium uppercase tracking-widest">
            {station.sport?.name ?? 'Station'}
          </span>
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
        </div>
        <h2 className="text-white text-2xl font-bold mt-1">{station.name}</h2>
      </div>

      {/* Players + scores */}
      <div className="flex flex-1 divide-x divide-gray-700">
        {[teamA, teamB].map((player, i) => {
          if (!player) return null
          const remaining = scores[player.user_id] ?? 501
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-center py-8 px-4 gap-3">
              <span className={`text-gray-300 font-semibold truncate max-w-full ${nameSize}`}>
                {player.users.name}
              </span>
              <span className={`text-white font-black tabular-nums leading-none ${scoreSize}`}>
                {remaining}
              </span>
              <span className="text-gray-500 text-sm">
                {player.legs_won} {player.legs_won === 1 ? 'leg' : 'legs'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Leg indicator */}
      {match && (
        <div className="px-6 py-3 border-t border-gray-700 text-center">
          <span className="text-gray-500 text-sm">
            Leg {match.current_leg} of {match.legs_to_win * 2 - 1}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Idle screen (no active matches) ─────────────────────────────────────────

function IdleScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="text-8xl">🎯</div>
      <p className="text-gray-500 text-2xl font-light tracking-wide">No active matches</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StationsDisplay() {
  const { venueSlug } = useParams<{ venueSlug?: string }>()
  const [venueId, setVenueId] = useState<string | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [page, setPage] = useState(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!venueSlug) {
      getAllStations().then(setStations)
      channelRef.current = supabase
        .channel('tv-stations')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stations' }, () => {
          getAllStations().then(s => { setStations(s); setPage(0) })
        })
        .subscribe()
      return () => {
        channelRef.current?.unsubscribe()
        if (cycleRef.current) clearInterval(cycleRef.current)
      }
    }

    supabase
      .from('venues')
      .select('id')
      .eq('slug', venueSlug)
      .single()
      .then(({ data }) => {
        if (!data) return
        const vid = data.id
        setVenueId(vid)
        getStationsForVenue(vid).then(setStations)
        channelRef.current = supabase
          .channel(`tv-stations-${venueSlug}`)
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'stations',
            filter: `venue_id=eq.${vid}`,
          }, () => {
            getStationsForVenue(vid).then(s => { setStations(s); setPage(0) })
          })
          .subscribe()
      })

    return () => {
      channelRef.current?.unsubscribe()
      if (cycleRef.current) clearInterval(cycleRef.current)
    }
  }, [venueSlug])

  // Auto-cycle when there are more active matches than fit on screen
  const active = stations.filter(s => s.status === 'in_use')
  const totalPages = Math.max(1, Math.ceil(active.length / CARDS_PER_PAGE))

  useEffect(() => {
    if (cycleRef.current) clearInterval(cycleRef.current)
    if (totalPages > 1) {
      cycleRef.current = setInterval(() => {
        setPage(p => (p + 1) % totalPages)
      }, CYCLE_MS)
    }
    return () => { if (cycleRef.current) clearInterval(cycleRef.current) }
  }, [totalPages])

  const visible = active.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE)

  const gridCols = visible.length === 1 ? 'grid-cols-1'
    : visible.length === 2 ? 'grid-cols-2'
    : visible.length === 3 ? 'grid-cols-3'
    : 'grid-cols-2'

  return (
    <div
      className="fixed inset-0 bg-gray-950 flex flex-col"
      style={{ zIndex: 9999 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎯</span>
          <span className="text-white text-xl font-bold tracking-tight">Live Matches</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span>{active.length} active</span>
          {totalPages > 1 && (
            <span className="flex gap-1.5">
              {Array.from({ length: totalPages }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full ${i === page ? 'bg-white' : 'bg-gray-700'}`}
                />
              ))}
            </span>
          )}
          <Clock />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 p-6">
        {active.length === 0 ? (
          <IdleScreen />
        ) : (
          <div className={`grid ${gridCols} gap-6 h-full`}>
            {visible.map(s => (
              <StationTile key={s.id} station={s} totalVisible={visible.length} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Live clock ───────────────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  return <span className="font-mono text-white text-base">{time}</span>
}

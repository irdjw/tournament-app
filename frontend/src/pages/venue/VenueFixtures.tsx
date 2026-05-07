import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Fixture {
  id: string
  name: string
  day_of_week: number
  start_time: string
}

interface Round {
  id: string
  fixture_id: string
  fixture_name: string
  round_number: number
  played_on: string | null
  status: string
}

interface Pairing {
  id: string
  home_player: { name: string }
  away_player: { name: string }
  match: { id: string; status: string } | null
  match_players: Array<{ user_id: string; legs_won: number }>
}

function nextOccurrence(dayOfWeek: number, startTime: string): Date {
  const today = new Date()
  const diff = (dayOfWeek - today.getDay() + 7) % 7 || 7
  const d = new Date(today)
  d.setDate(today.getDate() + diff)
  return d
}

export default function VenueFixtures() {
  const venue = useVenue()
  useDocumentTitle(`${venue.name} — Fixtures`)

  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pairings, setPairings] = useState<Record<string, Pairing[]>>({})
  const [loadingPairings, setLoadingPairings] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: fixtureData } = await supabase
        .from('fixtures')
        .select('id, name, day_of_week, start_time')
        .eq('venue_id', venue.id)
        .eq('active', true)
        .order('created_at', { ascending: false })

      const items = (fixtureData ?? []) as Fixture[]
      setFixtures(items)

      if (items.length === 0) { setLoading(false); return }

      const ids = items.map(f => f.id)
      const fixtureMap = new Map(items.map(f => [f.id, f.name]))

      const { data: roundData } = await supabase
        .from('fixture_rounds')
        .select('id, fixture_id, round_number, played_on, status')
        .in('fixture_id', ids)
        .order('played_on', { ascending: false })

      setRounds(
        (roundData ?? []).map((r: any) => ({
          ...r,
          fixture_name: fixtureMap.get(r.fixture_id) ?? '—',
        })),
      )
      setLoading(false)
    }

    load()
  }, [venue.id])

  async function loadPairings(roundId: string) {
    if (pairings[roundId]) {
      setExpanded(expanded === roundId ? null : roundId)
      return
    }
    setLoadingPairings(roundId)
    setExpanded(roundId)

    const { data } = await supabase
      .from('fixture_pairings')
      .select(`
        id,
        home_player:home_player_id(name),
        away_player:away_player_id(name),
        match:match_id(id, status, match_players(user_id, legs_won))
      `)
      .eq('fixture_round_id', roundId)

    setPairings(p => ({ ...p, [roundId]: (data ?? []) as any[] }))
    setLoadingPairings(null)
  }

  const completedRounds = rounds.filter(r => r.status === 'complete')
  const activeRounds = rounds.filter(r => r.status !== 'complete')

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Fixtures</h1>

      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
      ) : (
        <>
          {/* Upcoming nights */}
          {fixtures.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Upcoming</h2>
              <div className="space-y-2">
                {fixtures.flatMap(f => {
                  const next = nextOccurrence(f.day_of_week, f.start_time)
                  return [0, 7].map(offset => {
                    const d = new Date(next)
                    d.setDate(next.getDate() + offset)
                    return (
                      <div key={`${f.id}-${offset}`} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                        <div>
                          <p className="text-white font-medium text-sm">{f.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{DAYS[f.day_of_week]} at {f.start_time ?? '—'}</p>
                        </div>
                        <p className="text-gray-300 text-sm">
                          {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    )
                  })
                })}
              </div>
            </div>
          )}

          {/* Active / in-progress rounds */}
          {activeRounds.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">In Progress</h2>
              <div className="space-y-2">
                {activeRounds.map(round => (
                  <RoundAccordion
                    key={round.id}
                    round={round}
                    isExpanded={expanded === round.id}
                    onToggle={() => loadPairings(round.id)}
                    pairings={pairings[round.id] ?? null}
                    loadingPairings={loadingPairings === round.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed rounds */}
          {completedRounds.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Past Rounds</h2>
              <div className="space-y-2">
                {completedRounds.map(round => (
                  <RoundAccordion
                    key={round.id}
                    round={round}
                    isExpanded={expanded === round.id}
                    onToggle={() => loadPairings(round.id)}
                    pairings={pairings[round.id] ?? null}
                    loadingPairings={loadingPairings === round.id}
                  />
                ))}
              </div>
            </div>
          )}

          {rounds.length === 0 && fixtures.length > 0 && (
            <p className="text-gray-500 text-sm text-center py-8">No rounds played yet.</p>
          )}

          {fixtures.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">No active leagues at this venue.</p>
          )}
        </>
      )}
    </div>
  )
}

function RoundAccordion({
  round, isExpanded, onToggle, pairings, loadingPairings,
}: {
  round: Round
  isExpanded: boolean
  onToggle: () => void
  pairings: Pairing[] | null
  loadingPairings: boolean
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="text-left">
          <p className="text-white text-sm font-medium">
            {round.fixture_name} — Round {round.round_number}
          </p>
          {round.played_on && (
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(round.played_on).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            round.status === 'complete' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'
          }`}>
            {round.status === 'complete' ? 'Complete' : 'In Progress'}
          </span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-800">
          {loadingPairings ? (
            <p className="text-gray-500 text-sm text-center py-4">Loading…</p>
          ) : !pairings || pairings.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No pairings found.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {pairings.map(p => {
                const matchPlayers = (p.match as any)?.match_players ?? []
                const status = (p.match as any)?.status
                return (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3 text-sm flex-1 min-w-0">
                      <span className={`font-medium truncate ${
                        status === 'complete' && matchPlayers[0]?.legs_won > matchPlayers[1]?.legs_won
                          ? 'text-white' : 'text-gray-300'
                      }`}>
                        {(p.home_player as any)?.name ?? '—'}
                      </span>
                      <span className="text-gray-600 text-xs shrink-0">vs</span>
                      <span className={`font-medium truncate ${
                        status === 'complete' && matchPlayers[1]?.legs_won > matchPlayers[0]?.legs_won
                          ? 'text-white' : 'text-gray-300'
                      }`}>
                        {(p.away_player as any)?.name ?? '—'}
                      </span>
                    </div>
                    <div className="shrink-0 ml-3 text-right">
                      {status === 'complete' ? (
                        <span className="text-white font-bold tabular-nums text-sm">
                          {matchPlayers[0]?.legs_won ?? 0}–{matchPlayers[1]?.legs_won ?? 0}
                        </span>
                      ) : (
                        <span className="text-xs text-yellow-400">Live</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

const PAGE_SIZE = 20

interface Result {
  id: string
  created_at: string
  match_type: string
  sport: string
  players: Array<{ name: string; legs_won: number; team_id: string }>
}

interface Filter {
  sport: string
  type: string
  player: string
}

const MATCH_TYPE_BADGE: Record<string, string> = {
  league:     'bg-blue-900/40 text-blue-400',
  tournament: 'bg-purple-900/40 text-purple-400',
  friendly:   'bg-gray-800 text-gray-400',
}

export default function VenueResults() {
  const venue = useVenue()
  useDocumentTitle(`${venue.name} — Results`)

  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<Filter>({ sport: '', type: '', player: '' })
  const [sports, setSports] = useState<string[]>([])
  const loaderRef = useRef<HTMLDivElement>(null)

  async function fetchPage(p: number, f: Filter, append: boolean) {
    setLoading(true)

    let query = supabase
      .from('matches')
      .select('id, created_at, match_type, sport:sport_id(name), match_players(user_id, team_id, legs_won, users(name))')
      .eq('venue_id', venue.id)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)

    if (f.type) query = query.eq('match_type', f.type)

    const { data, error } = await query
    if (error) { setLoading(false); return }

    let rows: Result[] = (data ?? []).map((m: any) => ({
      id: m.id,
      created_at: m.created_at,
      match_type: m.match_type ?? 'friendly',
      sport: (m.sport as any)?.name ?? 'darts',
      players: ((m.match_players ?? []) as any[])
        .sort((a: any, b: any) => a.team_id.localeCompare(b.team_id))
        .map((pl: any) => ({ name: pl.users?.name ?? '—', legs_won: pl.legs_won ?? 0, team_id: pl.team_id })),
    }))

    // Client-side player filter (can't do server-side without complex join)
    if (f.player.trim()) {
      const q = f.player.toLowerCase()
      rows = rows.filter(r => r.players.some(pl => pl.name.toLowerCase().includes(q)))
    }
    if (f.sport) {
      rows = rows.filter(r => r.sport === f.sport)
    }

    if (p === 0) {
      const allSports = [...new Set((data ?? []).map((m: any) => (m.sport as any)?.name).filter(Boolean))]
      setSports(allSports as string[])
    }

    setResults(prev => append ? [...prev, ...rows] : rows)
    setHasMore((data ?? []).length === PAGE_SIZE)
    setLoading(false)
  }

  useEffect(() => {
    setPage(0)
    fetchPage(0, filter, false)
  }, [filter, venue.id])

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchPage(nextPage, filter, true)
        }
      },
      { threshold: 0.5 },
    )
    if (loaderRef.current) observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, page, filter])

  const types = ['league', 'tournament', 'friendly']

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Results</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {sports.length > 1 && (
          <select
            value={filter.sport}
            onChange={e => setFilter(f => ({ ...f, sport: e.target.value }))}
            className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All sports</option>
            {sports.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select
          value={filter.type}
          onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
          className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All types</option>
          {types.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        <input
          type="text"
          placeholder="Filter by player…"
          value={filter.player}
          onChange={e => setFilter(f => ({ ...f, player: e.target.value }))}
          className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {(filter.sport || filter.type || filter.player) && (
          <button
            onClick={() => setFilter({ sport: '', type: '', player: '' })}
            className="px-3 py-2 rounded-lg bg-gray-800 text-gray-400 text-sm hover:text-white hover:bg-gray-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {results.length === 0 && loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
      ) : results.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No results found.</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
          {results.map(result => {
            const [p1, p2] = result.players
            const winner = p1 && p2
              ? (p1.legs_won > p2.legs_won ? p1 : p1.legs_won < p2.legs_won ? p2 : null)
              : null
            const badge = MATCH_TYPE_BADGE[result.match_type]

            return (
              <div key={result.id} className="flex items-center gap-4 px-5 py-4">
                <div className="hidden sm:block text-xs text-gray-600 w-20 shrink-0">
                  {new Date(result.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`font-medium truncate ${winner === p1 ? 'text-white' : 'text-gray-400'}`}>
                      {p1?.name ?? '—'}
                    </span>
                    <span className="text-gray-600 text-xs shrink-0">vs</span>
                    <span className={`font-medium truncate ${winner === p2 ? 'text-white' : 'text-gray-400'}`}>
                      {p2?.name ?? '—'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 sm:hidden">
                    {new Date(result.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-white tabular-nums text-base">
                    {p1?.legs_won ?? 0}–{p2?.legs_won ?? 0}
                  </span>
                  <span className={`hidden sm:inline-block text-xs px-2 py-0.5 rounded-full font-medium ${badge ?? 'bg-gray-800 text-gray-400'}`}>
                    {result.match_type}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loaderRef} className="py-2">
        {loading && results.length > 0 && (
          <p className="text-gray-600 text-xs text-center">Loading more…</p>
        )}
        {!hasMore && results.length > 0 && (
          <p className="text-gray-700 text-xs text-center">All results loaded</p>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

interface MatchRow {
  id: string
  created_at: string
  status: string
  match_type: string
  sport: string
  players: Array<{ name: string; legs_won: number }>
}

interface MatchDetail {
  match: MatchRow
  events: Array<{ leg_number: number; user_id: string; playerName: string; remaining_score: number; created_at: string }>
}

export default function MatchHistory() {
  const { venueAdmin } = useAuth()
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [filter, setFilter] = useState({ sport: '', type: '', from: '', to: '' })
  const [sports, setSports] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  async function load() {
    if (!venueAdmin?.venue_id) return
    setLoading(true)

    let query = supabase
      .from('matches')
      .select(`
        id, created_at, status, match_type,
        sport:sport_id(name),
        match_players(user_id, legs_won, team_id, users(name))
      `)
      .eq('venue_id', venueAdmin.venue_id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filter.from) query = query.gte('created_at', filter.from)
    if (filter.to) query = query.lte('created_at', filter.to + 'T23:59:59')
    if (filter.type) query = query.eq('match_type', filter.type)

    const { data, error } = await query
    if (error) { setLoading(false); return }

    const rows: MatchRow[] = (data ?? []).map((m: any) => ({
      id: m.id,
      created_at: m.created_at,
      status: m.status,
      match_type: m.match_type ?? '—',
      sport: m.sport?.name ?? '—',
      players: (m.match_players ?? [])
        .sort((a: any, b: any) => a.team_id.localeCompare(b.team_id))
        .map((p: any) => ({ name: p.users?.name ?? '—', legs_won: p.legs_won ?? 0 })),
    }))

    setMatches(prev => page === 0 ? rows : [...prev, ...rows])
    if (page === 0) {
      const allSports = [...new Set(rows.map(r => r.sport).filter(s => s !== '—'))]
      setSports(allSports)
    }
    setLoading(false)
  }

  useEffect(() => { setPage(0); setMatches([]) }, [filter, venueAdmin?.venue_id])
  useEffect(() => { load() }, [page, filter, venueAdmin?.venue_id])

  async function openDetail(match: MatchRow) {
    const { data } = await supabase
      .from('match_events')
      .select('leg_number, user_id, remaining_score, created_at, users:user_id(name)')
      .eq('match_id', match.id)
      .order('created_at')

    const events = (data ?? []).map((e: any) => ({
      leg_number: e.leg_number,
      user_id: e.user_id,
      playerName: e.users?.name ?? '—',
      remaining_score: e.remaining_score,
      created_at: e.created_at,
    }))
    setDetail({ match, events })
  }

  const types = ['league', 'tournament', 'friendly']

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <h1 className="text-3xl font-bold text-white">Match History</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Sport</label>
          <select
            value={filter.sport}
            onChange={e => setFilter(f => ({ ...f, sport: e.target.value }))}
            className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All sports</option>
            {sports.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select
            value={filter.type}
            onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
            className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={filter.from}
            onChange={e => setFilter(f => ({ ...f, from: e.target.value }))}
            className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={filter.to}
            onChange={e => setFilter(f => ({ ...f, to: e.target.value }))}
            className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        {(filter.sport || filter.type || filter.from || filter.to) && (
          <button
            onClick={() => setFilter({ sport: '', type: '', from: '', to: '' })}
            className="px-3 py-2 rounded-lg bg-gray-800 text-gray-400 text-sm hover:text-white hover:bg-gray-700 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {matches.length === 0 && loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
      ) : matches.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No matches found.</p>
      ) : (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500">
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Players</th>
                  <th className="text-left px-4 py-3 font-medium">Sport</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-right px-4 py-3 font-medium">Result</th>
                  <th className="text-right px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {matches.map(m => (
                  <tr
                    key={m.id}
                    onClick={() => openDetail(m)}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-white">
                      {m.players.length >= 2
                        ? `${m.players[0].name} vs ${m.players[1].name}`
                        : m.players[0]?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 capitalize">{m.sport}</td>
                    <td className="px-4 py-3 text-gray-400 capitalize">{m.match_type}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {m.status === 'complete' && m.players.length >= 2
                        ? `${m.players[0].legs_won}–${m.players[1].legs_won}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          m.status === 'complete'
                            ? 'bg-green-900/40 text-green-400'
                            : m.status === 'in_progress'
                            ? 'bg-yellow-900/40 text-yellow-400'
                            : 'bg-gray-800 text-gray-500'
                        }`}
                      >
                        {m.status === 'in_progress' ? 'Live' : m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        </>
      )}

      {/* Match detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {detail.match.players.length >= 2
                    ? `${detail.match.players[0].name} vs ${detail.match.players[1].name}`
                    : 'Match Detail'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(detail.match.created_at).toLocaleString()} ·{' '}
                  {detail.match.sport} · {detail.match.match_type}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-500 hover:text-white p-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {detail.match.status === 'complete' && (
              <div className="flex items-center justify-center gap-8 py-6 border-b border-gray-800">
                {detail.match.players.map((p, i) => (
                  <div key={i} className="text-center">
                    <p className="text-white font-semibold">{p.name}</p>
                    <p className="text-4xl font-bold text-purple-300 mt-1">{p.legs_won}</p>
                    <p className="text-xs text-gray-500 mt-1">legs</p>
                  </div>
                ))}
              </div>
            )}

            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              {detail.events.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No scoring events recorded.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-800">
                      <th className="text-left pb-2 font-medium">Leg</th>
                      <th className="text-left pb-2 font-medium">Player</th>
                      <th className="text-right pb-2 font-medium">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.events.map((e, i) => (
                      <tr key={i} className="border-b border-gray-800/50">
                        <td className="py-2 text-gray-500 text-xs">{e.leg_number}</td>
                        <td className="py-2 text-white">{e.playerName}</td>
                        <td className="py-2 text-right text-gray-300">{e.remaining_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

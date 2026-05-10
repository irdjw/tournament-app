import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface VenueDetail {
  id: string
  name: string
  slug: string
}

interface MatchRow {
  id: string
  createdAt: string
  completedAt: string | null
  status: string
  sportName: string
}

interface PlayerRow {
  id: string
  name: string
  email: string | null
}

interface FixtureRow {
  id: string
  name: string
  active: boolean
}

interface TournamentRow {
  id: string
  name: string
  status: string
}

export default function VenueDeepDive() {
  const { id } = useParams<{ id: string }>()
  const [venue, setVenue] = useState<VenueDetail | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [fixtures, setFixtures] = useState<FixtureRow[]>([])
  const [tournaments, setTournaments] = useState<TournamentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    load(id)
  }, [id])

  async function load(venueId: string) {
    const [venueRes, matchRes, playerRes, fixtureRes, tourneyRes] = await Promise.all([
      supabase.from('venues').select('id, name, slug').eq('id', venueId).single(),
      supabase.from('matches').select('id, created_at, completed_at, status, sport:sport_id(name)')
        .eq('venue_id', venueId).order('created_at', { ascending: false }).limit(20),
      supabase.from('users').select('id, name, email').eq('venue_id', venueId).order('name'),
      supabase.from('fixtures').select('id, name, active').eq('venue_id', venueId).order('name'),
      supabase.from('tournaments').select('id, name, status').eq('venue_id', venueId)
        .order('created_at', { ascending: false }).limit(10),
    ])

    setVenue(venueRes.data as VenueDetail | null)
    setMatches(((matchRes.data ?? []) as any[]).map(m => ({
      id: m.id,
      createdAt: m.created_at,
      completedAt: m.completed_at,
      status: m.status,
      sportName: m.sport?.name ?? '—',
    })))
    setPlayers((playerRes.data ?? []) as PlayerRow[])
    setFixtures((fixtureRes.data ?? []) as FixtureRow[])
    setTournaments((tourneyRes.data ?? []) as TournamentRow[])
    setLoading(false)
  }

  async function deleteMatch(matchId: string) {
    await supabase.from('match_players').delete().eq('match_id', matchId)
    await supabase.from('match_events').delete().eq('match_id', matchId)
    await supabase.from('matches').delete().eq('id', matchId)
    setMatches(prev => prev.filter(m => m.id !== matchId))
    setDeleteConfirm(null)
  }

  function formatTime(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  const statusColour: Record<string, string> = {
    complete: 'text-green-400',
    in_progress: 'text-amber-400',
    pending: 'text-gray-400',
  }

  const tourneyStatusLabel: Record<string, string> = {
    setup: 'Setup', active: 'Active', group: 'Group Stage',
    brackets: 'Brackets', complete: 'Complete',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Loading venue data…</p>
      </div>
    )
  }

  if (!venue) {
    return (
      <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
        Venue not found.
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/admin/god"
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Platform
        </Link>
        <span className="text-gray-700">/</span>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <h1 className="text-xl font-bold text-white">{venue.name}</h1>
          <span className="text-xs text-red-400 bg-red-900/30 border border-red-800/50 px-2 py-0.5 rounded-full font-semibold uppercase tracking-widest">
            God Mode
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Matches */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent Matches</h2>
            <span className="text-xs text-gray-500">{matches.length} shown</span>
          </div>
          {matches.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500">No matches yet.</p>
          ) : (
            <ul className="divide-y divide-gray-800/50">
              {matches.map(m => (
                <li key={m.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-white capitalize">{m.sportName}</p>
                    <p className="text-xs text-gray-500">{formatTime(m.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs capitalize ${statusColour[m.status] ?? 'text-gray-400'}`}>
                      {m.status.replace('_', ' ')}
                    </span>
                    {deleteConfirm === m.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteMatch(m.id)}
                          className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded bg-red-900/30 hover:bg-red-900/50 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(m.id)}
                        className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                        title="Delete match"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Players */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-xs font-semibold text-white uppercase tracking-wide">
                Players ({players.length})
              </h2>
            </div>
            {players.length === 0 ? (
              <p className="px-4 py-4 text-xs text-gray-500">No players.</p>
            ) : (
              <ul className="divide-y divide-gray-800/50 max-h-48 overflow-y-auto">
                {players.map(p => (
                  <li key={p.id} className="px-4 py-2.5">
                    <p className="text-sm text-white">{p.name}</p>
                    {p.email && <p className="text-xs text-gray-500 truncate">{p.email}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fixtures */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-xs font-semibold text-white uppercase tracking-wide">Fixtures</h2>
            </div>
            {fixtures.length === 0 ? (
              <p className="px-4 py-4 text-xs text-gray-500">No fixtures.</p>
            ) : (
              <ul className="divide-y divide-gray-800/50">
                {fixtures.map(f => (
                  <li key={f.id} className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-sm text-white truncate">{f.name}</span>
                    <span className={`text-xs ml-2 shrink-0 ${f.active ? 'text-green-400' : 'text-gray-500'}`}>
                      {f.active ? 'Active' : 'Inactive'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tournaments */}
          {tournaments.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="text-xs font-semibold text-white uppercase tracking-wide">Tournaments</h2>
              </div>
              <ul className="divide-y divide-gray-800/50">
                {tournaments.map(t => (
                  <li key={t.id} className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-sm text-white truncate">{t.name}</span>
                    <span className="text-xs text-gray-500 ml-2 shrink-0">
                      {tourneyStatusLabel[t.status] ?? t.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

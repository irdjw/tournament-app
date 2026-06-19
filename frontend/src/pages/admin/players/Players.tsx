import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

interface Player {
  id: string
  name: string
  email: string
  played: number
  wins: number
  losses: number
  winRate: number
}

async function loadPlayers(venueId: string): Promise<Player[]> {
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('id')
    .eq('venue_id', venueId)

  const ids = (fixtures ?? []).map((f: any) => f.id)
  if (ids.length === 0) return []

  const { data: rows, error } = await supabase
    .from('standings')
    .select('user_id, played, wins, losses, user:user_id(id, name, email)')
    .in('fixture_id', ids)

  if (error) throw error

  const map = new Map<string, Player>()
  for (const row of rows ?? []) {
    const uid = row.user_id
    if (!map.has(uid)) {
      map.set(uid, {
        id: (row.user as any)?.id ?? uid,
        name: (row.user as any)?.name ?? '—',
        email: (row.user as any)?.email ?? '',
        played: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
      })
    }
    const e = map.get(uid)!
    e.played += row.played ?? 0
    e.wins += row.wins ?? 0
    e.losses += row.losses ?? 0
  }

  return [...map.values()].map(p => ({
    ...p,
    winRate: p.played > 0 ? Math.round((p.wins / p.played) * 100) : 0,
  }))
}

export default function Players() {
  const { venueAdmin } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [importText, setImportText] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const addNameRef = useRef<HTMLInputElement>(null)

  async function reload() {
    if (!venueAdmin?.venue_id) return
    setLoading(true)
    try {
      setPlayers(await loadPlayers(venueAdmin.venue_id))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [venueAdmin?.venue_id])

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!addName.trim()) return
    setAddLoading(true)
    try {
      const email = addEmail.trim() || `${addName.trim().toLowerCase().replace(/\s+/g, '')}@temp.com`
      await supabase
        .from('users')
        .upsert({ name: addName.trim(), email }, { onConflict: 'email' })
      setAddName('')
      setAddEmail('')
      setShowAdd(false)
      reload()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setAddLoading(false)
    }
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault()
    const names = importText.split('\n').map(n => n.trim()).filter(Boolean)
    if (names.length === 0) return
    setImportLoading(true)
    try {
      const rows = names.map(name => ({
        name,
        email: `${name.toLowerCase().replace(/\s+/g, '')}@temp.com`,
      }))
      const { error } = await supabase
        .from('users')
        .upsert(rows, { onConflict: 'email' })
      if (error) throw error
      setImportText('')
      setShowImport(false)
      reload()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setImportLoading(false)
    }
  }

  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold text-white">Players</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowImport(true) }}
            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors"
          >
            Import CSV
          </button>
          <button
            onClick={() => { setShowAdd(true); setTimeout(() => addNameRef.current?.focus(), 50) }}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
          >
            + Add Player
          </button>
        </div>
      </div>

      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search players…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
        />
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          {search ? 'No players match your search.' : 'No players yet. Add one to get started.'}
        </p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-right px-4 py-3 font-medium">Played</th>
                <th className="text-right px-4 py-3 font-medium">Won</th>
                <th className="text-right px-4 py-3 font-medium">Lost</th>
                <th className="text-right px-4 py-3 font-medium">Win %</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(player => (
                <tr
                  key={player.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/players/${player.id}`}
                      className="text-white font-medium hover:text-purple-300"
                    >
                      {player.name}
                    </Link>
                    {player.email && !player.email.includes('@temp.com') && (
                      <p className="text-xs text-gray-500">{player.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{player.played}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{player.wins}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{player.losses}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-medium ${
                        player.winRate >= 60
                          ? 'text-green-400'
                          : player.winRate >= 40
                          ? 'text-yellow-400'
                          : 'text-gray-400'
                      }`}
                    >
                      {player.winRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add player modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-4">Add Player</h2>
            <form onSubmit={handleAddPlayer} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Name *</label>
                <input
                  ref={addNameRef}
                  type="text"
                  required
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="Player name"
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Email (optional)</label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  placeholder="player@example.com"
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {addLoading ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-1">Bulk Import</h2>
            <p className="text-sm text-gray-400 mb-4">One player name per line.</p>
            <form onSubmit={handleBulkImport} className="space-y-4">
              <textarea
                rows={8}
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder={'Alice\nBob\nCharlie'}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowImport(false)}
                  className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importLoading || !importText.trim()}
                  className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {importLoading ? 'Importing…' : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

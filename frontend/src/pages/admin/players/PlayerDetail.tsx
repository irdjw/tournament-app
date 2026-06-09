import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

interface PlayerInfo {
  id: string
  name: string
  email: string
}

interface StandingRow {
  fixture_id: string
  fixtureName: string
  played: number
  wins: number
  losses: number
  legs_for: number
  legs_against: number
  points: number
}

interface MatchRow {
  id: string
  created_at: string
  status: string
  opponent: string
  result: 'win' | 'loss' | 'pending'
  legsFor: number
  legsAgainst: number
}

export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>()
  const { venueAdmin } = useAuth()
  const navigate = useNavigate()

  const [player, setPlayer] = useState<PlayerInfo | null>(null)
  const [standings, setStandings] = useState<StandingRow[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editName, setEditName] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!id || !venueAdmin?.venue_id) return

    async function load() {
      const venueId = venueAdmin!.venue_id

      const [userRes, fixturesRes] = await Promise.all([
        supabase.from('users').select('id, name, email').eq('id', id).single(),
        supabase.from('fixtures').select('id, name').eq('venue_id', venueId),
      ])

      if (userRes.error || !userRes.data) {
        setLoading(false)
        return
      }
      setPlayer(userRes.data)
      setEditName(userRes.data.name)

      const fixtureIds = (fixturesRes.data ?? []).map((f: any) => f.id)
      const fixtureMap = new Map((fixturesRes.data ?? []).map((f: any) => [f.id, f.name]))

      const [standingsRes, matchRes] = await Promise.all([
        fixtureIds.length > 0
          ? supabase
              .from('standings')
              .select('fixture_id, played, wins, losses, legs_for, legs_against, points')
              .eq('user_id', id)
              .in('fixture_id', fixtureIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        supabase
          .from('matches')
          .select('id, created_at, status, match_players(user_id, team_id, legs_won, users(id, name))')
          .eq('venue_id', venueId)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      const parsedStandings: StandingRow[] = (standingsRes.data ?? []).map((s: any) => ({
        fixture_id: s.fixture_id,
        fixtureName: fixtureMap.get(s.fixture_id) ?? '—',
        played: s.played,
        wins: s.wins,
        losses: s.losses,
        legs_for: s.legs_for,
        legs_against: s.legs_against,
        points: s.points,
      }))

      // Parse match history — only matches involving this player
      const parsedMatches: MatchRow[] = []
      for (const m of (matchRes.data ?? []) as any[]) {
        const players = m.match_players ?? []
        const myEntry = players.find((p: any) => p.user_id === id)
        if (!myEntry) continue
        const opponent = players.find((p: any) => p.user_id !== id)
        const opponentName = opponent?.users?.name ?? '—'

        let result: 'win' | 'loss' | 'pending' = 'pending'
        if (m.status === 'complete') {
          const myLegs = myEntry.legs_won ?? 0
          const oppLegs = opponent?.legs_won ?? 0
          result = myLegs > oppLegs ? 'win' : 'loss'
        }

        parsedMatches.push({
          id: m.id,
          created_at: m.created_at,
          status: m.status,
          opponent: opponentName,
          result,
          legsFor: myEntry.legs_won ?? 0,
          legsAgainst: opponent?.legs_won ?? 0,
        })
      }

      setStandings(parsedStandings)
      setMatches(parsedMatches)
      setLoading(false)
    }

    load()
  }, [id, venueAdmin?.venue_id])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim() || !player) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: editName.trim() })
        .eq('id', player.id)
      if (error) throw error
      setPlayer(p => p ? { ...p, name: editName.trim() } : p)
      setEditing(false)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!player || !venueAdmin?.venue_id) return
    setRemoving(true)
    try {
      const { data: fixtures } = await supabase
        .from('fixtures')
        .select('id')
        .eq('venue_id', venueAdmin.venue_id)
      const fixtureIds = (fixtures ?? []).map((f: any) => f.id)

      if (fixtureIds.length > 0) {
        await supabase
          .from('standings')
          .delete()
          .eq('user_id', player.id)
          .in('fixture_id', fixtureIds)
      }
      navigate('/admin/players')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  const totalPlayed = standings.reduce((s, r) => s + r.played, 0)
  const totalWins = standings.reduce((s, r) => s + r.wins, 0)
  const totalLosses = standings.reduce((s, r) => s + r.losses, 0)
  const winRate = totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : 0

  if (loading) {
    return <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
  }

  if (!player) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">Player not found.</p>
        <Link to="/admin/players" className="text-purple-400 text-sm mt-2 inline-block">
          ← Back to players
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/admin/players" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
            ← Players
          </Link>
          {editing ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-2 mt-1">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="text-2xl font-bold bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1 rounded-lg bg-purple-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setEditName(player.name) }}
                className="px-3 py-1 rounded-lg bg-gray-700 text-gray-300 text-sm"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-3xl font-bold text-white">{player.name}</h1>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded bg-gray-800"
              >
                Edit
              </button>
            </div>
          )}
          {player.email && !player.email.includes('@temp.com') && (
            <p className="text-sm text-gray-500 mt-1">{player.email}</p>
          )}
        </div>
        <button
          onClick={() => setConfirmRemove(true)}
          className="px-3 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-400 text-sm transition-colors border border-red-800/50"
        >
          Remove from venue
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Played', value: totalPlayed },
          { label: 'Won', value: totalWins },
          { label: 'Lost', value: totalLosses },
          { label: 'Win Rate', value: `${winRate}%` },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* League standings */}
      {standings.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">League Standings</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="text-left px-5 py-3 font-medium">League</th>
                <th className="text-right px-4 py-3 font-medium">P</th>
                <th className="text-right px-4 py-3 font-medium">W</th>
                <th className="text-right px-4 py-3 font-medium">L</th>
                <th className="text-right px-4 py-3 font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map(row => (
                <tr key={row.fixture_id} className="border-b border-gray-800/50">
                  <td className="px-5 py-3 text-white">
                    <Link to={`/admin/leagues/${row.fixture_id}`} className="hover:text-purple-300">
                      {row.fixtureName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{row.played}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{row.wins}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{row.losses}</td>
                  <td className="px-4 py-3 text-right text-purple-300 font-semibold">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Match history */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Match History</h2>
        </div>
        {matches.length === 0 ? (
          <p className="px-5 py-8 text-gray-500 text-sm text-center">No matches yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="text-left px-5 py-3 font-medium">Date</th>
                <th className="text-left px-5 py-3 font-medium">Opponent</th>
                <th className="text-right px-4 py-3 font-medium">Score</th>
                <th className="text-right px-4 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(m => (
                <tr key={m.id} className="border-b border-gray-800/50">
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-white">{m.opponent}</td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {m.status === 'complete' ? `${m.legsFor}–${m.legsAgainst}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.status !== 'complete' ? (
                      <span className="text-gray-500 text-xs">In progress</span>
                    ) : m.result === 'win' ? (
                      <span className="text-green-400 font-medium text-xs">Win</span>
                    ) : (
                      <span className="text-red-400 font-medium text-xs">Loss</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm remove dialog */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-2">Remove player?</h2>
            <p className="text-sm text-gray-400 mb-6">
              This removes <strong className="text-white">{player.name}</strong> from all leagues at
              this venue. Match history is preserved. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRemove(false)}
                className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

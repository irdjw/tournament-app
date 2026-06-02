import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import { getStandings, createFixtureRound, getNextRoundNumber } from '../../../lib/fixtures'

interface Fixture {
  id: string
  name: string
  day_of_week: number | null
  start_time: string | null
  active: boolean
  sport: { name: string } | null
}

interface StandingRow {
  user: { id: string; name: string }
  played: number
  wins: number
  losses: number
  legs_for: number
  legs_against: number
  points: number
}

interface Round {
  id: string
  round_number: number
  played_on: string | null
  status: string
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function LeagueDetail() {
  const { id } = useParams<{ id: string }>()
  const { venueAdmin } = useAuth()
  const navigate = useNavigate()

  const [fixture, setFixture] = useState<Fixture | null>(null)
  const [standings, setStandings] = useState<StandingRow[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [loading, setLoading] = useState(true)
  const [startingRound, setStartingRound] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  async function reload() {
    if (!id) return
    const [fixtureRes, standingsData, roundsRes] = await Promise.all([
      supabase
        .from('fixtures')
        .select('id, name, day_of_week, start_time, active, sport:sport_id(name)')
        .eq('id', id)
        .single(),
      getStandings(id).catch(() => [] as StandingRow[]),
      supabase
        .from('fixture_rounds')
        .select('id, round_number, played_on, status')
        .eq('fixture_id', id)
        .order('round_number', { ascending: false }),
    ])

    if (fixtureRes.data) {
      setFixture(fixtureRes.data as Fixture)
      setEditName((fixtureRes.data as any).name)
    }
    setStandings(standingsData as StandingRow[])
    setRounds((roundsRes.data ?? []) as Round[])
    setLoading(false)
  }

  useEffect(() => { reload() }, [id])

  async function handleStartRound() {
    if (!id) return
    setStartingRound(true)
    try {
      const roundNumber = await getNextRoundNumber(id)
      const round = await createFixtureRound(id, roundNumber, new Date().toISOString().split('T')[0])
      navigate(`/bar/league/round/${round.id}`)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setStartingRound(false)
    }
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !newPlayerName.trim()) return
    setAddingPlayer(true)
    try {
      const email = `${newPlayerName.trim().toLowerCase().replace(/\s+/g, '')}@temp.com`
      const { data: user, error: uErr } = await supabase
        .from('users')
        .upsert({ name: newPlayerName.trim(), email }, { onConflict: 'email' })
        .select('id')
        .single()
      if (uErr) throw uErr

      const { error: sErr } = await supabase
        .from('standings')
        .upsert(
          { fixture_id: id, user_id: user.id, played: 0, wins: 0, losses: 0, legs_for: 0, legs_against: 0, points: 0 },
          { onConflict: 'fixture_id,user_id' },
        )
      if (sErr) throw sErr

      setNewPlayerName('')
      setShowAddPlayer(false)
      reload()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setAddingPlayer(false)
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !editName.trim()) return
    setSavingEdit(true)
    try {
      await supabase.from('fixtures').update({ name: editName.trim() }).eq('id', id)
      setFixture(f => f ? { ...f, name: editName.trim() } : f)
      setEditing(false)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSavingEdit(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
  }

  if (!fixture) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">League not found.</p>
        <Link to="/admin/leagues" className="text-purple-400 text-sm mt-2 inline-block">← Leagues</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/admin/leagues" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
            ← Leagues
          </Link>
          {editing ? (
            <form onSubmit={handleSaveEdit} className="flex items-center gap-2 mt-1">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="text-2xl font-bold bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button type="submit" disabled={savingEdit} className="px-3 py-1 rounded-lg bg-purple-600 text-white text-sm disabled:opacity-50">
                {savingEdit ? '…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="px-3 py-1 rounded-lg bg-gray-700 text-gray-300 text-sm">Cancel</button>
            </form>
          ) : (
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-2xl font-bold text-white">{fixture.name}</h1>
              <button onClick={() => setEditing(true)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded bg-gray-800">Edit</button>
            </div>
          )}
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
            {fixture.sport && <span className="capitalize">{fixture.sport.name}</span>}
            {fixture.day_of_week != null && <span>{DAYS[fixture.day_of_week]}</span>}
            {fixture.start_time && <span>{fixture.start_time}</span>}
          </div>
        </div>
        <button
          onClick={handleStartRound}
          disabled={startingRound}
          className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors disabled:opacity-50"
        >
          {startingRound ? 'Starting…' : "Start Tonight's Round"}
        </button>
      </div>

      {/* Standings */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Standings</h2>
          <button
            onClick={() => setShowAddPlayer(true)}
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            + Add player
          </button>
        </div>
        {standings.length === 0 ? (
          <p className="px-5 py-8 text-gray-500 text-sm text-center">No players yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="text-left px-5 py-3 font-medium">#</th>
                <th className="text-left px-5 py-3 font-medium">Player</th>
                <th className="text-right px-4 py-3 font-medium">P</th>
                <th className="text-right px-4 py-3 font-medium">W</th>
                <th className="text-right px-4 py-3 font-medium">L</th>
                <th className="text-right px-4 py-3 font-medium">Legs +/-</th>
                <th className="text-right px-4 py-3 font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => (
                <tr key={row.user?.id ?? i} className="border-b border-gray-800/50">
                  <td className="px-5 py-3 text-gray-500 text-xs">{i + 1}</td>
                  <td className="px-5 py-3">
                    <Link
                      to={`/admin/players/${row.user?.id}`}
                      className="text-white font-medium hover:text-purple-300"
                    >
                      {row.user?.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{row.played}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{row.wins}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{row.losses}</td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {row.legs_for - row.legs_against > 0 ? '+' : ''}{row.legs_for - row.legs_against}
                  </td>
                  <td className="px-4 py-3 text-right text-purple-300 font-semibold">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Rounds */}
      {rounds.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">Round History</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {rounds.map(round => (
              <Link
                key={round.id}
                to={`/bar/league/round/${round.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-800/30 transition-colors"
              >
                <div>
                  <span className="text-white text-sm font-medium">Round {round.round_number}</span>
                  {round.played_on && (
                    <span className="text-gray-500 text-xs ml-3">
                      {new Date(round.played_on).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    round.status === 'complete'
                      ? 'bg-green-900/40 text-green-400'
                      : 'bg-yellow-900/40 text-yellow-400'
                  }`}
                >
                  {round.status === 'complete' ? 'Complete' : 'In Progress'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Add player modal */}
      {showAddPlayer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-4">Add Player to League</h2>
            <form onSubmit={handleAddPlayer} className="space-y-4">
              <input
                autoFocus
                type="text"
                required
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                placeholder="Player name"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddPlayer(false)} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={addingPlayer} className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50">
                  {addingPlayer ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

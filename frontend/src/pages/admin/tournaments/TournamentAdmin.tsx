import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

interface Participant {
  id: string
  user_id: string
  seed: number
  name: string
}

interface TMatch {
  id: string
  match_id: string
  round: number
  status: string
  bracket: string
  players: Array<{ name: string; legs_won: number; team_id: string }>
}

interface Tournament {
  id: string
  name: string
  format: string
  status: string
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  setup:    { label: 'Setup',       cls: 'bg-gray-700 text-gray-300' },
  active:   { label: 'Active',      cls: 'bg-green-900/40 text-green-400' },
  group:    { label: 'Group Stage', cls: 'bg-blue-900/40 text-blue-400' },
  brackets: { label: 'Brackets',   cls: 'bg-purple-900/40 text-purple-400' },
  complete: { label: 'Complete',    cls: 'bg-gray-700 text-gray-400' },
}

function exportCSV(tournament: Tournament, matches: TMatch[], participants: Participant[]) {
  const rows = [
    ['Tournament', tournament.name],
    ['Format', tournament.format],
    ['Status', tournament.status],
    [],
    ['Participants'],
    ['Seed', 'Name'],
    ...participants.map(p => [p.seed, p.name]),
    [],
    ['Matches'],
    ['Round', 'Bracket', 'Player 1', 'Player 2', 'Score', 'Status'],
    ...matches.map(m => [
      m.round,
      m.bracket,
      m.players[0]?.name ?? '—',
      m.players[1]?.name ?? '—',
      m.status === 'complete' ? `${m.players[0]?.legs_won ?? 0}–${m.players[1]?.legs_won ?? 0}` : '—',
      m.status,
    ]),
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tournament.name.replace(/\s+/g, '_')}_results.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function TournamentAdmin() {
  const { id } = useParams<{ id: string }>()
  const { venueAdmin } = useAuth()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [matches, setMatches] = useState<TMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSeeds, setSavingSeeds] = useState(false)

  async function load() {
    if (!id) return
    const [tourRes, partRes, matchRes] = await Promise.all([
      supabase.from('tournaments').select('id, name, format, status').eq('id', id).single(),
      supabase
        .from('tournament_participants')
        .select('id, user_id, seed, users:user_id(name)')
        .eq('tournament_id', id)
        .order('seed'),
      supabase
        .from('tournament_matches')
        .select(`
          id, round, match_id,
          group:group_id(type),
          match:match_id(id, status, match_players(user_id, team_id, legs_won, users(name)))
        `)
        .eq('tournament_id', id)
        .order('round'),
    ])

    if (tourRes.data) setTournament(tourRes.data as Tournament)

    const parsedParts: Participant[] = (partRes.data ?? []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      seed: p.seed,
      name: p.users?.name ?? '—',
    }))
    setParticipants(parsedParts)

    const parsedMatches: TMatch[] = (matchRes.data ?? []).map((m: any) => ({
      id: m.id,
      match_id: m.match_id,
      round: m.round,
      bracket: (m.group as any)?.type ?? '—',
      status: (m.match as any)?.status ?? '—',
      players: ((m.match as any)?.match_players ?? []).map((p: any) => ({
        name: p.users?.name ?? '—',
        legs_won: p.legs_won ?? 0,
        team_id: p.team_id,
      })),
    }))
    setMatches(parsedMatches)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const reordered = Array.from(participants)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)
    setParticipants(reordered.map((p, i) => ({ ...p, seed: i + 1 })))
  }

  async function saveSeeds() {
    setSavingSeeds(true)
    try {
      await Promise.all(
        participants.map(p =>
          supabase
            .from('tournament_participants')
            .update({ seed: p.seed })
            .eq('id', p.id),
        ),
      )
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSavingSeeds(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
  }
  if (!tournament) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">Tournament not found.</p>
        <Link to="/admin/tournaments" className="text-purple-400 text-sm mt-2 inline-block">← Tournaments</Link>
      </div>
    )
  }

  const badge = STATUS_BADGE[tournament.status] ?? { label: tournament.status, cls: 'bg-gray-700 text-gray-300' }
  const isSetup = tournament.status === 'setup'
  const grouped = matches.reduce((acc, m) => {
    const key = `Round ${m.round}`
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, TMatch[]>)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/admin/tournaments" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
            ← Tournaments
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold text-white">{tournament.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1 capitalize">{tournament.format.replace(/_/g, ' ')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tournament.status === 'complete' && (
            <button
              onClick={() => exportCSV(tournament, matches, participants)}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
            >
              Export CSV
            </button>
          )}
          <Link
            to={`/bar/tournament/${id}`}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
          >
            Open in Bar Mode
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Participants / seeding */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">
                Participants ({participants.length})
              </h2>
              {isSetup && (
                <button
                  onClick={saveSeeds}
                  disabled={savingSeeds}
                  className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50"
                >
                  {savingSeeds ? 'Saving…' : 'Save seeds'}
                </button>
              )}
            </div>

            {isSetup ? (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="participants">
                  {provided => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="divide-y divide-gray-800">
                      {participants.map((p, index) => (
                        <Draggable key={p.id} draggableId={p.id} index={index}>
                          {(drag, snapshot) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                              className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                                snapshot.isDragging ? 'bg-gray-800' : 'hover:bg-gray-800/30'
                              }`}
                            >
                              <span className="text-xs text-gray-500 w-4 shrink-0">{p.seed}</span>
                              <span className="text-white text-sm flex-1">{p.name}</span>
                              <span className="text-gray-600 text-xs">⠿</span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <div className="divide-y divide-gray-800">
                {participants.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-xs text-gray-500 w-4 shrink-0">{p.seed}</span>
                    <span className="text-white text-sm">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {isSetup && (
            <p className="text-xs text-gray-500 mt-2 px-1">Drag to re-seed before the tournament starts.</p>
          )}
        </div>

        {/* Match table */}
        <div className="lg:col-span-2 space-y-4">
          {Object.entries(grouped).length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
              Matches will appear once the tournament is generated.
            </div>
          ) : (
            Object.entries(grouped).map(([roundLabel, roundMatches]) => (
              <div key={roundLabel} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-white">{roundLabel}</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-800">
                      <th className="text-left px-5 py-2 font-medium">Match</th>
                      <th className="text-right px-4 py-2 font-medium">Score</th>
                      <th className="text-right px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundMatches.map(m => (
                      <tr key={m.id} className="border-b border-gray-800/50">
                        <td className="px-5 py-3 text-white">
                          {m.players[0]?.name ?? 'TBD'} <span className="text-gray-500">vs</span> {m.players[1]?.name ?? 'TBD'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {m.status === 'complete'
                            ? `${m.players[0]?.legs_won ?? 0}–${m.players[1]?.legs_won ?? 0}`
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
                            {m.status === 'in_progress' ? 'Live' : m.status === 'complete' ? 'Done' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

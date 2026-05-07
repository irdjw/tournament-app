import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

interface Tournament {
  id: string
  name: string
  format: string
  status: string
}

interface Participant {
  seed: number
  name: string
}

interface TMatch {
  id: string
  match_id: string
  round: number
  bracket: string
  status: string
  legs_to_win: number
  players: Array<{ name: string; legs_won: number; team_id: string }>
}

interface GroupRow {
  name: string
  played: number
  wins: number
  losses: number
  points: number
}

interface Group {
  id: string
  name: string
  type: string
  rows: GroupRow[]
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  setup:    { label: 'Setup',       cls: 'bg-gray-800 text-gray-400' },
  active:   { label: 'Active',      cls: 'bg-green-900/40 text-green-400' },
  group:    { label: 'Group Stage', cls: 'bg-blue-900/40 text-blue-400' },
  brackets: { label: 'Brackets',   cls: 'bg-purple-900/40 text-purple-400' },
  complete: { label: 'Complete',    cls: 'bg-gray-700 text-gray-400' },
}

const FORMAT_LABEL: Record<string, string> = {
  single_elimination: 'Single Elim.',
  double_elimination: 'Double Elim.',
  group_stage: 'Group Stage',
}

function MatchCard({ match }: { match: TMatch }) {
  const [p1, p2] = match.players
  const winner = match.status === 'complete'
    ? (p1?.legs_won > (p2?.legs_won ?? -1) ? p1 : p2)
    : null

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden min-w-[180px] w-full">
      {[p1, p2].map((p, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-3 py-2.5 text-sm ${
            i === 0 ? 'border-b border-gray-700' : ''
          } ${winner && p?.name === winner.name ? 'bg-purple-900/40' : ''}`}
        >
          <span className={`truncate ${
            !p?.name || p.name === 'TBD' ? 'text-gray-600 italic' :
            winner && p.name === winner.name ? 'text-white font-semibold' : 'text-gray-300'
          }`}>
            {p?.name ?? 'TBD'}
          </span>
          {match.status === 'complete' && (
            <span className={`ml-2 font-bold tabular-nums shrink-0 ${
              winner && p?.name === winner.name ? 'text-purple-300' : 'text-gray-500'
            }`}>
              {p?.legs_won ?? 0}
            </span>
          )}
          {match.status === 'in_progress' && (
            <span className="ml-2 text-yellow-400 text-xs shrink-0 font-semibold">
              {p?.legs_won ?? 0}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function BracketSection({ title, rounds }: { title: string; rounds: Record<number, TMatch[]> }) {
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b)

  return (
    <div className="mb-6">
      {title && <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {roundNumbers.map(round => (
            <div key={round} className="flex flex-col gap-3" style={{ width: 200 }}>
              <p className="text-xs text-gray-500 font-medium text-center">
                {roundNumbers.length === 1 ? 'Final' :
                  round === Math.max(...roundNumbers) ? 'Final' :
                  round === Math.max(...roundNumbers) - 1 ? 'Semi-final' :
                  `Round ${round}`}
              </p>
              {rounds[round].map(m => <MatchCard key={m.id} match={m} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function VenueTournament() {
  const { id } = useParams<{ id: string }>()
  const venue = useVenue()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [matches, setMatches] = useState<TMatch[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useDocumentTitle(tournament ? `${tournament.name} — ${venue.name}` : venue.name)

  useEffect(() => {
    if (!id) return

    async function load() {
      const [tourRes, partRes, matchRes] = await Promise.all([
        supabase
          .from('tournaments')
          .select('id, name, format, status')
          .eq('id', id)
          .eq('venue_id', venue.id)
          .single(),
        supabase
          .from('tournament_participants')
          .select('seed, users:user_id(name)')
          .eq('tournament_id', id)
          .order('seed'),
        supabase
          .from('tournament_matches')
          .select(`
            id, round,
            group:group_id(id, name, type),
            match:match_id(id, status, legs_to_win, match_players(user_id, team_id, legs_won, users(name)))
          `)
          .eq('tournament_id', id)
          .order('round'),
      ])

      if (tourRes.error || !tourRes.data) { setNotFound(true); setLoading(false); return }
      setTournament(tourRes.data as Tournament)

      setParticipants(
        (partRes.data ?? []).map((p: any) => ({ seed: p.seed, name: p.users?.name ?? '—' })),
      )

      const parsedMatches: TMatch[] = (matchRes.data ?? []).map((m: any) => ({
        id: m.id,
        match_id: (m.match as any)?.id ?? '',
        round: m.round,
        bracket: (m.group as any)?.type ?? 'winners',
        status: (m.match as any)?.status ?? 'pending',
        legs_to_win: (m.match as any)?.legs_to_win ?? 2,
        players: ((m.match as any)?.match_players ?? [])
          .sort((a: any, b: any) => a.team_id.localeCompare(b.team_id))
          .map((p: any) => ({ name: p.users?.name ?? 'TBD', legs_won: p.legs_won ?? 0, team_id: p.team_id })),
      }))
      setMatches(parsedMatches)

      // Build group tables for group_stage format
      const groupMatches = parsedMatches.filter(m => m.bracket === 'group')
      if (groupMatches.length > 0) {
        const groupData = (matchRes.data ?? []).filter((m: any) => (m.group as any)?.type === 'group')
        const groupMap = new Map<string, { id: string; name: string; matches: TMatch[] }>()
        for (const m of groupData) {
          const g = m.group as any
          if (!g?.id) continue
          if (!groupMap.has(g.id)) groupMap.set(g.id, { id: g.id, name: g.name, matches: [] })
          const pm = parsedMatches.find(pm => pm.id === m.id)
          if (pm) groupMap.get(g.id)!.matches.push(pm)
        }

        const builtGroups: Group[] = []
        for (const { id: gId, name: gName, matches: gMatches } of groupMap.values()) {
          const playerMap = new Map<string, GroupRow>()
          for (const m of gMatches) {
            for (const p of m.players) {
              if (!playerMap.has(p.name)) playerMap.set(p.name, { name: p.name, played: 0, wins: 0, losses: 0, points: 0 })
            }
            if (m.status === 'complete') {
              const winner = m.players.find(p => p.legs_won > (m.legs_to_win - 1))
              for (const p of m.players) {
                const row = playerMap.get(p.name)!
                row.played++
                if (winner?.name === p.name) { row.wins++; row.points += 2 }
                else { row.losses++ }
              }
            }
          }
          builtGroups.push({
            id: gId,
            name: gName,
            type: 'group',
            rows: [...playerMap.values()].sort((a, b) => b.points - a.points),
          })
        }
        setGroups(builtGroups)
      }

      setLoading(false)
    }

    load()
  }, [id, venue.id])

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: tournament?.name ?? 'Tournament', url }) } catch (_) {}
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copied!')
    }
  }

  if (loading) return <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
  if (notFound || !tournament) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-3">Tournament not found.</p>
        <Link to={`/v/${venue.slug}`} className="text-purple-400 text-sm">← Back</Link>
      </div>
    )
  }

  const badge = STATUS_BADGE[tournament.status] ?? { label: tournament.status, cls: 'bg-gray-800 text-gray-400' }

  // Group matches by bracket type and round
  const byBracket: Record<string, Record<number, TMatch[]>> = {}
  for (const m of matches.filter(m => m.bracket !== 'group')) {
    if (!byBracket[m.bracket]) byBracket[m.bracket] = {}
    if (!byBracket[m.bracket][m.round]) byBracket[m.bracket][m.round] = []
    byBracket[m.bracket][m.round].push(m)
  }

  const bracketOrder = ['winners', 'losers', 'grand_final']
  const bracketLabel: Record<string, string> = {
    winners: 'Winners Bracket',
    losers: 'Losers Bracket',
    grand_final: 'Grand Final',
  }

  const completedMatches = matches.filter(m => m.status === 'complete')
    .sort((a, b) => {
      const ai = matches.indexOf(a)
      const bi = matches.indexOf(b)
      return bi - ai
    })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to={`/v/${venue.slug}`} className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">← {venue.name}</Link>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{tournament.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {FORMAT_LABEL[tournament.format] ?? tournament.format} · {participants.length} players
          </p>
        </div>
        <button
          onClick={handleShare}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
        >
          Share
        </button>
      </div>

      {/* Group stage */}
      {groups.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-4">Groups</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <div key={group.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/50">
                  <h3 className="text-sm font-semibold text-white">{group.name}</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-800">
                      <th className="text-left px-4 py-2 font-medium">Player</th>
                      <th className="text-right px-2 py-2 font-medium">P</th>
                      <th className="text-right px-2 py-2 font-medium">W</th>
                      <th className="text-right px-4 py-2 font-medium">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, i) => (
                      <tr key={row.name} className={`border-b border-gray-800/50 ${i === 0 ? 'bg-green-900/10' : ''}`}>
                        <td className="px-4 py-2 text-white">{row.name}</td>
                        <td className="px-2 py-2 text-right text-gray-400">{row.played}</td>
                        <td className="px-2 py-2 text-right text-gray-400">{row.wins}</td>
                        <td className="px-4 py-2 text-right text-purple-300 font-bold">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bracket */}
      {Object.keys(byBracket).length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-4">Bracket</h2>
          {bracketOrder
            .filter(b => byBracket[b])
            .map(bracket => (
              <BracketSection
                key={bracket}
                title={Object.keys(byBracket).length > 1 ? bracketLabel[bracket] ?? bracket : ''}
                rounds={byBracket[bracket]}
              />
            ))}
        </div>
      )}

      {/* Results feed */}
      {completedMatches.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-3">Results</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
            {completedMatches.slice(0, 20).map(m => {
              const [p1, p2] = m.players
              const winner = p1?.legs_won > p2?.legs_won ? p1 : p2
              return (
                <div key={m.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={p1 === winner ? 'text-white font-medium' : 'text-gray-400'}>{p1?.name ?? '—'}</span>
                    <span className="text-gray-600 text-xs">vs</span>
                    <span className={p2 === winner ? 'text-white font-medium' : 'text-gray-400'}>{p2?.name ?? '—'}</span>
                  </div>
                  <span className="font-bold text-white tabular-nums ml-3 shrink-0">
                    {p1?.legs_won ?? 0}–{p2?.legs_won ?? 0}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tournament.status === 'setup' && participants.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-3">Players ({participants.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {participants.map(p => (
              <div key={p.seed} className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 text-xs w-4">{p.seed}</span>
                <span className="text-white">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

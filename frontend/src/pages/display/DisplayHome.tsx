import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface ActiveTournament {
  id: string
  name: string
  status: string
}

interface ActiveRound {
  id: string
  round_number: number
  fixture: { id: string; name: string }
}

export default function DisplayHome() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tournaments, setTournaments] = useState<ActiveTournament[]>([])
  const [rounds, setRounds] = useState<ActiveRound[]>([])
  const [hasStations, setHasStations] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    const [{ data: tData }, { data: rData }, { data: sData }] = await Promise.all([
      supabase
        .from('tournaments')
        .select('id, name, status')
        .in('status', ['active', 'group', 'brackets'])
        .order('created_at', { ascending: false }),
      supabase
        .from('fixture_rounds')
        .select('id, round_number, fixture:fixture_id(id, name)')
        .eq('status', 'in_progress')
        .order('round_number', { ascending: false }),
      supabase
        .from('stations')
        .select('id')
        .limit(1),
    ])

    const activeTournaments = (tData as ActiveTournament[]) ?? []
    const activeRounds = (rData as unknown as ActiveRound[]) ?? []

    setTournaments(activeTournaments)
    setRounds(activeRounds)
    setHasStations(((sData ?? []).length > 0))
    setLoading(false)

    // Auto-redirect if exactly one clear option
    if (activeTournaments.length === 1 && activeRounds.length === 0) {
      navigate(`/display/tournament/${activeTournaments[0].id}`, { replace: true })
      return
    }
    if (activeRounds.length === 1 && activeTournaments.length === 0) {
      navigate('/display/stations', { replace: true })
      return
    }
    if (activeTournaments.length === 0 && activeRounds.length === 0) {
      // Nothing active — show stations scoreboard
      navigate('/display/stations', { replace: true })
      return
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">Detecting active events…</div>
      </div>
    )
  }

  // Multiple things running — show manual override
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-2">Display Mode</h1>
      <p className="text-gray-400 mb-8">Multiple events detected — choose what to show:</p>

      <div className="grid gap-4 w-full max-w-lg">
        {hasStations && (
          <Link
            to="/display/stations"
            className="block p-5 bg-gray-800 rounded-2xl hover:bg-gray-700 transition-colors no-underline text-white border border-gray-600"
          >
            <div className="text-2xl mb-1">📋</div>
            <div className="text-xl font-bold">Station Scoreboard</div>
            <div className="text-sm text-gray-400 mt-0.5">Live scores for all active boards</div>
          </Link>
        )}

        {tournaments.map(t => (
          <Link
            key={t.id}
            to={`/display/tournament/${t.id}`}
            className="block p-5 bg-gray-800 rounded-2xl hover:bg-gray-700 transition-colors no-underline text-white border border-purple-700/50"
          >
            <div className="text-2xl mb-1">🏆</div>
            <div className="text-xl font-bold">{t.name}</div>
            <div className="text-sm text-gray-400 mt-0.5 capitalize">Tournament · {t.status}</div>
          </Link>
        ))}

        {rounds.length > 0 && (
          <Link
            to="/display/stations"
            className="block p-5 bg-gray-800 rounded-2xl hover:bg-gray-700 transition-colors no-underline text-white border border-amber-700/50"
          >
            <div className="text-2xl mb-1">🍺</div>
            <div className="text-xl font-bold">League Night Boards</div>
            <div className="text-sm text-gray-400 mt-0.5">
              {rounds.map(r => `${r.fixture?.name} R${r.round_number}`).join(', ')}
            </div>
          </Link>
        )}
      </div>

      <div className="mt-8 text-sm text-gray-600">
        This page auto-redirects when only one event is active.
      </div>
    </div>
  )
}

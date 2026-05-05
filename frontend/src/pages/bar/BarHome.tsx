import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import BarNav from '../../components/BarNav'
import { getAllStations } from '../../lib/stations'

interface ActiveTournament {
  id: string
  name: string
  status: string
}

interface ActiveFixture {
  id: string
  name: string
  day_of_week: number
  active_round: { id: string; round_number: number } | null
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function BarHome() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<ActiveTournament[]>([])
  const [fixtures, setFixtures] = useState<ActiveFixture[]>([])
  const [stationTotal, setStationTotal] = useState(0)
  const [stationInUse, setStationInUse] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      const [{ data: tData }, { data: fData }, { data: roundData }, stations] = await Promise.all([
        supabase
          .from('tournaments')
          .select('id, name, status')
          .in('status', ['active', 'group', 'brackets'])
          .order('created_at', { ascending: false }),
        supabase
          .from('fixtures')
          .select('id, name, day_of_week')
          .eq('active', true)
          .order('name'),
        supabase
          .from('fixture_rounds')
          .select('id, round_number, fixture_id')
          .eq('status', 'in_progress')
          .order('round_number', { ascending: false }),
        getAllStations(),
      ])

      setTournaments((tData as ActiveTournament[]) ?? [])

      // Match in-progress rounds to their fixtures (single query, no loop)
      const roundsByFixture = new Map<string, { id: string; round_number: number }>()
      for (const r of (roundData ?? []) as { id: string; round_number: number; fixture_id: string }[]) {
        if (!roundsByFixture.has(r.fixture_id)) {
          roundsByFixture.set(r.fixture_id, { id: r.id, round_number: r.round_number })
        }
      }

      const activeFixtures: ActiveFixture[] = ((fData ?? []) as { id: string; name: string; day_of_week: number }[])
        .filter(f => roundsByFixture.has(f.id))
        .map(f => ({ ...f, active_round: roundsByFixture.get(f.id) ?? null }))

      setFixtures(activeFixtures)
      setStationTotal(stations.length)
      setStationInUse(stations.filter(s => s.status === 'in_use').length)
    } finally {
      setLoading(false)
    }
  }

  const statusLabel: Record<string, string> = {
    active: 'Live',
    group: 'Groups',
    brackets: 'Brackets',
    complete: 'Done',
  }
  const statusColor: Record<string, string> = {
    active: 'bg-amber-500',
    group: 'bg-blue-500',
    brackets: 'bg-purple-500',
    complete: 'bg-green-500',
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <BarNav />

      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 mt-2">
          <h1 className="text-2xl font-bold">Bar Mode</h1>
          <Link
            to="/bar/settings"
            className="text-gray-400 hover:text-white text-2xl transition-colors"
            title="Settings"
          >
            ⚙️
          </Link>
        </div>

        {/* Station status banner */}
        {!loading && stationTotal > 0 && (
          <div
            className="mb-5 p-3 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-between cursor-pointer hover:bg-gray-700 transition-colors"
            onClick={() => navigate('/bar/stations')}
          >
            <span className="text-sm text-gray-300">📋 Stations</span>
            <span className="text-sm font-semibold">
              <span className={stationInUse > 0 ? 'text-amber-400' : 'text-green-400'}>
                {stationInUse}
              </span>
              <span className="text-gray-400"> / {stationTotal} in use</span>
            </span>
          </div>
        )}

        {/* Three main action buttons */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          <Link
            to="/bar/league/setup"
            className="block p-5 bg-gradient-to-br from-amber-600 to-orange-700 rounded-2xl text-white no-underline hover:from-amber-500 hover:to-orange-600 transition-all shadow-lg"
          >
            <div className="text-3xl mb-1">🍺</div>
            <div className="text-xl font-bold">League Night</div>
            <div className="text-sm text-amber-100 mt-0.5">Set up or continue a league round</div>
          </Link>

          <Link
            to="/bar/tournament/new"
            className="block p-5 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl text-white no-underline hover:from-purple-500 hover:to-indigo-600 transition-all shadow-lg"
          >
            <div className="text-3xl mb-1">🏆</div>
            <div className="text-xl font-bold">Tournament</div>
            <div className="text-sm text-purple-100 mt-0.5">Create and run a knockout or group tournament</div>
          </Link>

          <Link
            to="/bar/match-setup"
            className="block p-5 bg-gradient-to-br from-green-600 to-teal-700 rounded-2xl text-white no-underline hover:from-green-500 hover:to-teal-600 transition-all shadow-lg"
          >
            <div className="text-3xl mb-1">🎯</div>
            <div className="text-xl font-bold">Casual Match</div>
            <div className="text-sm text-green-100 mt-0.5">Quick one-off match scoring</div>
          </Link>
        </div>

        {/* Active league nights */}
        {fixtures.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Active League Night</h2>
            {fixtures.map(f => (
              <Link
                key={f.id}
                to={f.active_round ? `/bar/league/round/${f.active_round.id}` : `/bar/league/${f.id}`}
                className="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-amber-700/40 hover:bg-gray-700 transition-colors no-underline text-white mb-2"
              >
                <div>
                  <div className="font-semibold">{f.name}</div>
                  <div className="text-xs text-gray-400">
                    {DAY_NAMES[f.day_of_week]}s
                    {f.active_round && <span className="ml-2 text-amber-400">Round {f.active_round.round_number} in progress</span>}
                  </div>
                </div>
                <span className="text-amber-400 text-lg">→</span>
              </Link>
            ))}
          </section>
        )}

        {/* Active tournaments */}
        {tournaments.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Active Tournaments</h2>
            {tournaments.map(t => (
              <Link
                key={t.id}
                to={`/bar/tournament/${t.id}`}
                className="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-purple-700/40 hover:bg-gray-700 transition-colors no-underline text-white mb-2"
              >
                <span className="font-semibold">{t.name}</span>
                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full text-white ${statusColor[t.status] ?? 'bg-gray-600'}`}>
                  {statusLabel[t.status] ?? t.status}
                </span>
              </Link>
            ))}
          </section>
        )}

        {/* Secondary links */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Manage</h2>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/bar/stations"
              className="p-3 bg-gray-800 rounded-xl text-center text-sm font-medium hover:bg-gray-700 transition-colors no-underline text-gray-200"
            >
              📋 Stations
            </Link>
            <Link
              to="/bar/settings"
              className="p-3 bg-gray-800 rounded-xl text-center text-sm font-medium hover:bg-gray-700 transition-colors no-underline text-gray-200"
            >
              ⚙️ Settings
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

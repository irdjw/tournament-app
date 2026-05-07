import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

interface Fixture {
  id: string
  name: string
  day_of_week: string
  start_time: string
  active: boolean
  sport: { name: string } | null
  playerCount: number
  roundCount: number
}

export default function Leagues() {
  const { venueAdmin } = useAuth()
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venueAdmin?.venue_id) return

    async function load() {
      const { data, error } = await supabase
        .from('fixtures')
        .select('id, name, day_of_week, start_time, active, sport:sport_id(name)')
        .eq('venue_id', venueAdmin!.venue_id)
        .order('created_at', { ascending: false })

      if (error || !data) { setLoading(false); return }

      const enriched = await Promise.all(
        data.map(async (f: any) => {
          const [playersRes, roundsRes] = await Promise.all([
            supabase
              .from('standings')
              .select('user_id', { count: 'exact', head: true })
              .eq('fixture_id', f.id),
            supabase
              .from('fixture_rounds')
              .select('id', { count: 'exact', head: true })
              .eq('fixture_id', f.id),
          ])
          return {
            ...f,
            playerCount: playersRes.count ?? 0,
            roundCount: roundsRes.count ?? 0,
          } as Fixture
        }),
      )

      setFixtures(enriched)
      setLoading(false)
    }

    load()
  }, [venueAdmin?.venue_id])

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Leagues</h1>
        <Link
          to="/admin/leagues/new"
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
        >
          + New League
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
      ) : fixtures.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">No leagues yet.</p>
          <Link
            to="/admin/leagues/new"
            className="mt-3 inline-block text-purple-400 hover:text-purple-300 text-sm"
          >
            Create your first league →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fixtures.map(f => (
            <Link
              key={f.id}
              to={`/admin/leagues/${f.id}`}
              className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-base font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {f.name}
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5 capitalize">
                    {f.sport?.name ?? 'Sport'}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    f.active
                      ? 'bg-green-900/40 text-green-400 border border-green-800/50'
                      : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  {f.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                {f.day_of_week !== undefined && (
                  <span>{DAYS[Number(f.day_of_week)] ?? f.day_of_week}</span>
                )}
                {f.start_time && <span>{f.start_time}</span>}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span>{f.playerCount} players</span>
                <span>{f.roundCount} rounds played</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

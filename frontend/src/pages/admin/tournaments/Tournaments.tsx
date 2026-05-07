import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

interface Tournament {
  id: string
  name: string
  format: string
  status: string
  created_at: string
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  setup:     { label: 'Setup',       cls: 'bg-gray-800 text-gray-400' },
  active:    { label: 'Active',      cls: 'bg-green-900/40 text-green-400 border border-green-800/50' },
  group:     { label: 'Group Stage', cls: 'bg-blue-900/40 text-blue-400 border border-blue-800/50' },
  brackets:  { label: 'Brackets',   cls: 'bg-purple-900/40 text-purple-400 border border-purple-800/50' },
  complete:  { label: 'Complete',    cls: 'bg-gray-800 text-gray-500' },
}

const FORMAT_LABEL: Record<string, string> = {
  single_elimination: 'Single Elimination',
  double_elimination: 'Double Elimination',
  group_stage: 'Group Stage',
}

export default function Tournaments() {
  const { venueAdmin } = useAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venueAdmin?.venue_id) return

    supabase
      .from('tournaments')
      .select('id, name, format, status, created_at')
      .eq('venue_id', venueAdmin.venue_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTournaments((data ?? []) as Tournament[])
        setLoading(false)
      })
  }, [venueAdmin?.venue_id])

  const active = tournaments.filter(t => !['complete', 'setup'].includes(t.status))
  const past = tournaments.filter(t => t.status === 'complete')
  const draft = tournaments.filter(t => t.status === 'setup')

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Tournaments</h1>
        <Link
          to="/bar/tournament/new"
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
        >
          + New Tournament
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
      ) : tournaments.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">No tournaments yet.</p>
          <Link to="/bar/tournament/new" className="mt-3 inline-block text-purple-400 hover:text-purple-300 text-sm">
            Create your first tournament →
          </Link>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <Section title="Active" items={active} />
          )}
          {draft.length > 0 && (
            <Section title="Draft" items={draft} />
          )}
          {past.length > 0 && (
            <Section title="Completed" items={past} />
          )}
        </>
      )}
    </div>
  )
}

function Section({ title, items }: { title: string; items: Tournament[] }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800">
        {items.map(t => {
          const badge = STATUS_BADGE[t.status] ?? { label: t.status, cls: 'bg-gray-800 text-gray-400' }
          return (
            <Link
              key={t.id}
              to={`/admin/tournaments/${t.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-800/30 transition-colors"
            >
              <div>
                <p className="text-white font-medium">{t.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {FORMAT_LABEL[t.format] ?? t.format} · {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.cls}`}>
                {badge.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

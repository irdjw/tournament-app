import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

interface Tournament {
  id: string
  name: string
  format: string | null
  status: string
  created_at: string
  scheduled_for: string | null
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  setup:     { label: 'Scheduled',    cls: 'bg-gray-800 text-gray-400' },
  active:    { label: 'Active',       cls: 'bg-green-900/40 text-green-400 border border-green-800/50' },
  group:     { label: 'Group Stage',  cls: 'bg-blue-900/40 text-blue-400 border border-blue-800/50' },
  brackets:  { label: 'Brackets',    cls: 'bg-purple-900/40 text-purple-400 border border-purple-800/50' },
  complete:  { label: 'Complete',     cls: 'bg-gray-800 text-gray-500' },
}

const FORMAT_LABEL: Record<string, string> = {
  single_elimination: 'Single Elimination',
  double_elimination: 'Double Elimination',
  group_stage: 'Group Stage',
}

function fmtScheduled(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function Tournaments() {
  const { venueAdmin } = useAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venueAdmin?.venue_id) return

    supabase
      .from('tournaments')
      .select('id, name, format, status, created_at, scheduled_for')
      .eq('venue_id', venueAdmin.venue_id)
      .order('scheduled_for', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTournaments((data ?? []) as Tournament[])
        setLoading(false)
      })
  }, [venueAdmin?.venue_id])

  const active    = tournaments.filter(t => !['complete', 'setup'].includes(t.status))
  const scheduled = tournaments.filter(t => t.status === 'setup')
  const past      = tournaments.filter(t => t.status === 'complete')

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Tournaments</h1>
        <div className="flex gap-2">
          <Link
            to="/admin/tournaments/schedule"
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors border border-gray-700"
          >
            Schedule
          </Link>
          <Link
            to="/bar/tournament/new"
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
          >
            + Start now
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
      ) : tournaments.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">No tournaments yet.</p>
          <div className="flex gap-4 justify-center mt-4">
            <Link to="/admin/tournaments/schedule" className="text-gray-400 hover:text-gray-300 text-sm">
              Schedule recurring nights →
            </Link>
            <Link to="/bar/tournament/new" className="text-purple-400 hover:text-purple-300 text-sm">
              Start one now →
            </Link>
          </div>
        </div>
      ) : (
        <>
          {active.length > 0 && <Section title="Active" items={active} />}
          {scheduled.length > 0 && <Section title="Scheduled" items={scheduled} />}
          {past.length > 0 && <Section title="Completed" items={past} />}
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
          const formatLabel = t.format ? (FORMAT_LABEL[t.format] ?? t.format) : 'Format TBD'
          return (
            <Link
              key={t.id}
              to={`/admin/tournaments/${t.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-800/30 transition-colors"
            >
              <div>
                <p className="text-white font-medium">{t.name}</p>
                <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
                  {t.scheduled_for ? (
                    <span className="text-gray-400">{fmtScheduled(t.scheduled_for)}</span>
                  ) : (
                    <span>{new Date(t.created_at).toLocaleDateString()}</span>
                  )}
                  <span className="text-gray-700">·</span>
                  <span className={t.format ? '' : 'text-amber-500/80'}>{formatLabel}</span>
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

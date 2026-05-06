import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface TournamentRow {
  id: string
  name: string
  format: string
  status: string
  created_at: string
}

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: 'Single Elimination',
  double_elimination: 'Double Elimination',
  group_stage: 'Group Stage',
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  setup: { label: 'Setting Up', cls: 'bg-gray-700 text-gray-300' },
  active: { label: 'Live', cls: 'bg-amber-600 text-black' },
  group: { label: 'Groups', cls: 'bg-blue-600 text-white' },
  brackets: { label: 'Brackets', cls: 'bg-purple-600 text-white' },
  complete: { label: 'Complete', cls: 'bg-green-700 text-green-200' },
}

export default function TournamentList() {
  const [active, setActive] = useState<TournamentRow[]>([])
  const [past, setPast] = useState<TournamentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('tournaments')
        .select('id, name, format, status, created_at')
        .in('status', ['active', 'group', 'brackets', 'setup'])
        .order('created_at', { ascending: false }),
      supabase
        .from('tournaments')
        .select('id, name, format, status, created_at')
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(20),
    ]).then(([{ data: a }, { data: p }]) => {
      setActive((a as TournamentRow[]) ?? [])
      setPast((p as TournamentRow[]) ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-lg animate-pulse">Loading…</div>
      </div>
    )
  }

  const TournamentCard = ({ t }: { t: TournamentRow }) => {
    const sc = STATUS_CONFIG[t.status] ?? { label: t.status, cls: 'bg-gray-700 text-gray-300' }
    return (
      <Link
        to={`/tournament/${t.id}`}
        className="flex items-center justify-between bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-xl px-4 py-3 gap-3 transition-colors no-underline"
      >
        <div className="min-w-0">
          <div className="font-semibold text-white truncate">{t.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">{FORMAT_LABELS[t.format] ?? t.format}</div>
        </div>
        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${sc.cls}`}>
          {sc.label}
        </span>
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div>
          <Link to="/" className="text-gray-500 text-xs mb-2 block">← Back</Link>
          <h1 className="text-2xl font-black">Tournaments</h1>
        </div>

        {/* Active */}
        {active.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Active</h2>
            {active.map(t => <TournamentCard key={t.id} t={t} />)}
          </section>
        )}

        {/* Completed */}
        {past.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Past Tournaments</h2>
            {past.map(t => <TournamentCard key={t.id} t={t} />)}
          </section>
        )}

        {active.length === 0 && past.length === 0 && (
          <div className="text-center text-gray-600 py-16">
            <div className="text-4xl mb-3">🏆</div>
            <div>No tournaments yet</div>
          </div>
        )}

      </div>
    </div>
  )
}

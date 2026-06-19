import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

interface Tournament {
  id: string
  name: string
  format: string | null
  status: string
  created_at: string
  scheduled_for: string | null
  participant_count: number
}

type FilterTab = 'all' | 'pending' | 'in_progress' | 'complete'

const FORMAT_LABEL: Record<string, string> = {
  single_elimination: 'Single Elimination',
  double_elimination: 'Double Elimination',
  group_stage:        'Group Stage',
}

const PROGRESS: Record<string, { pct: number; color: string }> = {
  setup:     { pct: 5,   color: 'bg-gray-500' },
  active:    { pct: 40,  color: 'bg-green-500' },
  group:     { pct: 50,  color: 'bg-blue-500' },
  brackets:  { pct: 75,  color: 'bg-purple-500' },
  complete:  { pct: 100, color: 'bg-green-500' },
}

function SportIcon({ format }: { format: string | null }) {
  return (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${format ? 'bg-purple-600' : 'bg-gray-700'}`}>
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    </div>
  )
}

function TournamentCard({ t }: { t: Tournament }) {
  const prog = PROGRESS[t.status] ?? { pct: 0, color: 'bg-gray-500' }
  const formatLabel = t.format ? (FORMAT_LABEL[t.format] ?? t.format) : 'Format TBD'
  const dateStr = t.scheduled_for
    ? new Date(t.scheduled_for + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <Link
      to={`/admin/tournaments/${t.id}`}
      className="flex items-center gap-4 px-4 py-4 hover:bg-white/5 transition-colors rounded-xl group"
    >
      <SportIcon format={t.format} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-white font-semibold truncate">{t.name}</p>
          {t.status !== 'setup' && t.participant_count > 0 && (
            <div className="flex items-center gap-1 text-gray-400 text-xs shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {t.participant_count}
            </div>
          )}
        </div>
        <p className={`text-xs mt-0.5 ${t.format ? 'text-gray-400' : 'text-amber-500/80'}`}>
          {formatLabel} · {dateStr}
        </p>
        <div className="mt-2 h-1 w-full bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${prog.color}`}
            style={{ width: `${prog.pct}%` }}
          />
        </div>
      </div>
    </Link>
  )
}

export default function Tournaments() {
  const { venueAdmin } = useAuth()
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!venueAdmin?.venue_id) return
    supabase
      .from('tournaments')
      .select('id, name, format, status, created_at, scheduled_for, tournament_participants(count)')
      .eq('venue_id', venueAdmin.venue_id)
      .order('scheduled_for', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const parsed: Tournament[] = (data ?? []).map((t: any) => ({
          id: t.id,
          name: t.name,
          format: t.format,
          status: t.status,
          created_at: t.created_at,
          scheduled_for: t.scheduled_for,
          participant_count: t.tournament_participants?.[0]?.count ?? 0,
        }))
        setTournaments(parsed)
        setLoading(false)
      })
  }, [venueAdmin?.venue_id])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = tournaments.filter(t => {
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'pending' ? t.status === 'setup' :
      filter === 'in_progress' ? ['active', 'group', 'brackets'].includes(t.status) :
      t.status === 'complete'
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all',         label: 'All' },
    { key: 'pending',     label: 'Pending' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'complete',    label: 'Complete' },
  ]

  const venueName = venueAdmin?.venue?.name ?? ''

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Your Tournaments</h1>
        {venueName && <p className="text-gray-400 text-sm mt-1">{venueName}</p>}
      </div>

      {/* CTA */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(o => !o)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors"
        >
          + New Tournament
          <svg className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {dropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden">
            <button
              onClick={() => { setDropdownOpen(false); navigate('/bar/tournament/new') }}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </span>
              <div>
                <p className="text-white text-sm font-medium">Start tonight</p>
                <p className="text-gray-500 text-xs">Set up and launch right now</p>
              </div>
            </button>
            <div className="h-px bg-gray-800" />
            <button
              onClick={() => { setDropdownOpen(false); navigate('/admin/tournaments/schedule') }}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </span>
              <div>
                <p className="text-white text-sm font-medium">Schedule recurring nights</p>
                <p className="text-gray-500 text-xs">Plan weekly tournaments in advance</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              filter === tab.key
                ? 'bg-gray-700 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search tournaments…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
        />
      </div>

      {/* List */}
      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm">
            {tournaments.length === 0 ? 'No tournaments yet.' : 'No tournaments match your search.'}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800/60">
          {filtered.map(t => <TournamentCard key={t.id} t={t} />)}
        </div>
      )}
    </div>
  )
}

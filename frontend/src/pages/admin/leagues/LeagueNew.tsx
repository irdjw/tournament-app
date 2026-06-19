import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function LeagueNew() {
  const { venueAdmin } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [day, setDay] = useState('3')
  const [time, setTime] = useState('19:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!venueAdmin?.venue_id || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      let { data: sport } = await supabase
        .from('sports')
        .select('id')
        .eq('name', 'darts')
        .single()

      if (!sport) {
        const { data: created } = await supabase
          .from('sports')
          .insert({ name: 'darts' })
          .select('id')
          .single()
        sport = created
      }

      const { data: fixture, error: fixErr } = await supabase
        .from('fixtures')
        .insert({
          venue_id: venueAdmin.venue_id,
          sport_id: sport!.id,
          name: name.trim(),
          day_of_week: parseInt(day),
          start_time: time,
          active: true,
        })
        .select('id')
        .single()

      if (fixErr) throw fixErr
      navigate(`/admin/leagues/${fixture.id}`)
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div>
        <Link to="/admin/leagues" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
          ← Leagues
        </Link>
        <h1 className="text-3xl font-bold text-white">New League</h1>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">League Name *</label>
            <input
              autoFocus
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Wednesday Night Darts"
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Day of week</label>
              <select
                value={day}
                onChange={e => setDay(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Start time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Link
              to="/admin/leagues"
              className="flex-1 text-center py-2.5 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create League'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { scheduleTournaments } from '../../../lib/tournaments'

function addWeeks(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n * 7)
  return d.toISOString().split('T')[0]
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function ScheduleTournaments() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [sport, setSport] = useState<'darts' | 'pool'>('darts')
  const [legs, setLegs] = useState(3)
  const [startingScore, setStartingScore] = useState<301 | 501>(501)
  const [doubleOut, setDoubleOut] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [recurMode, setRecurMode] = useState<'weeks' | 'endDate'>('weeks')
  const [weeks, setWeeks] = useState(4)
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const dates = useMemo<string[]>(() => {
    if (!startDate) return []
    if (!recurring) return [startDate]

    const result: string[] = [startDate]
    for (let i = 1; i < 52; i++) {
      const next = addWeeks(startDate, i)
      if (recurMode === 'weeks' && i >= weeks) break
      if (recurMode === 'endDate' && endDate && next > endDate) break
      result.push(next)
    }
    return result
  }, [startDate, recurring, recurMode, weeks, endDate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Tournament name is required'); return }
    if (!startDate) { setError('Start date is required'); return }
    if (recurring && recurMode === 'endDate' && !endDate) { setError('End date is required'); return }
    if (dates.length === 0) { setError('No dates generated'); return }

    setLoading(true)
    setError('')
    try {
      await scheduleTournaments(name.trim(), sport, { legs, startingScore, doubleOut, groupSize: 4 }, dates)
      navigate('/admin/tournaments')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link to="/admin/tournaments" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
          ← Tournaments
        </Link>
        <h1 className="text-2xl font-bold text-white">Schedule Tournaments</h1>
        <p className="text-gray-400 text-sm mt-1">
          Create tournament slots in advance. The knockout format is chosen on the night once you know how many players turn up.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Tournament name</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder="Tuesday Night Darts"
            className="w-full rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
          {dates.length > 1 && (
            <p className="text-xs text-gray-500 mt-1">The date will be appended to each session's name automatically.</p>
          )}
        </div>

        {/* Sport */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Sport</label>
          <div className="flex gap-2">
            {(['darts', 'pool'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSport(s)}
                className={`flex-1 py-2.5 rounded-lg font-semibold capitalize text-sm border transition-colors ${
                  sport === s
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Game config */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <p className="text-sm font-medium text-gray-300">Game settings</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Legs</label>
              <select
                value={legs}
                onChange={e => setLegs(parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value={1}>1 leg</option>
                <option value={3}>Best of 3</option>
                <option value={5}>Best of 5</option>
                <option value={7}>Best of 7</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Starting score</label>
              <div className="flex gap-2">
                {([301, 501] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStartingScore(s)}
                    className={`flex-1 py-2 rounded-lg font-semibold text-sm border transition-colors ${
                      startingScore === s
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Double out</label>
            <div className="flex gap-2">
              {([true, false] as const).map(v => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setDoubleOut(v)}
                  className={`flex-1 py-2 rounded-lg font-semibold text-sm border transition-colors ${
                    doubleOut === v
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400'
                  }`}
                >
                  {v ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {recurring ? 'First date' : 'Date'}
          </label>
          <input
            type="date"
            required
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>

        {/* Recurring toggle */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => setRecurring(r => !r)}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${recurring ? 'bg-purple-600' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${recurring ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm font-medium text-gray-300">Recurring weekly</span>
          </label>

          {recurring && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
              <div className="flex gap-2">
                {(['weeks', 'endDate'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRecurMode(mode)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      recurMode === mode
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                  >
                    {mode === 'weeks' ? 'Number of weeks' : 'End date'}
                  </button>
                ))}
              </div>

              {recurMode === 'weeks' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    How many weeks? <span className="text-gray-600">(max 52)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={weeks}
                    onChange={e => setWeeks(Math.min(52, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    End date <span className="text-gray-600">(max 52 weeks from start)</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    max={startDate ? addWeeks(startDate, 52) : undefined}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview */}
        {dates.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm font-semibold text-white mb-3">
              {dates.length} tournament{dates.length !== 1 ? 's' : ''} will be created
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {dates.map((d, i) => (
                <div key={d} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-600 w-5 text-right text-xs tabular-nums">{i + 1}</span>
                  <span className="text-gray-300">{fmtDate(d)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Link
            to="/admin/tournaments"
            className="flex-1 py-3 text-center bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || dates.length === 0}
            className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors"
          >
            {loading
              ? 'Scheduling…'
              : `Schedule ${dates.length > 1 ? `${dates.length} tournaments` : 'tournament'}`}
          </button>
        </div>
      </form>
    </div>
  )
}

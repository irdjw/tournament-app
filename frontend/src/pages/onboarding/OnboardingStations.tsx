import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createStation } from '../../lib/stations'

interface OnboardingData {
  venueId: string
  venueSlug: string
  venueName: string
  userId: string
  sports: string[]
  sportIds: Record<string, string>
}

function getOnboarding(): OnboardingData | null {
  try { return JSON.parse(sessionStorage.getItem('onboarding') ?? 'null') } catch { return null }
}

interface PendingStation {
  id: string
  name: string
  sport: string
}

const SPORT_ICON: Record<string, string> = { darts: '🎯', pool: '🎱' }
const SPORT_LABEL: Record<string, string> = { darts: 'Dart Board', pool: 'Pool Table' }

export default function OnboardingStations() {
  const navigate = useNavigate()
  const [ob] = useState(getOnboarding)
  const [pending, setPending] = useState<PendingStation[]>([])
  const [customName, setCustomName] = useState('')
  const [customSport, setCustomSport] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ob) { navigate('/onboarding', { replace: true }); return }
    if (ob.sports.length > 0) setCustomSport(ob.sports[0])
  }, [ob, navigate])

  if (!ob) return null

  function quickAdd(sport: string, count: number) {
    const prefix = SPORT_LABEL[sport] ?? sport
    const existing = pending.filter(p => p.sport === sport).length
    setPending(p => [
      ...p,
      ...Array.from({ length: count }, (_, i) => ({
        id: crypto.randomUUID(),
        name: `${prefix} ${existing + i + 1}`,
        sport,
      })),
    ])
  }

  function remove(id: string) {
    setPending(p => p.filter(s => s.id !== id))
  }

  function rename(id: string, name: string) {
    setPending(p => p.map(s => s.id === id ? { ...s, name } : s))
  }

  function addCustom() {
    const name = customName.trim()
    if (!name || !customSport) return
    setPending(p => [...p, { id: crypto.randomUUID(), name, sport: customSport }])
    setCustomName('')
  }

  async function handleNext() {
    setLoading(true)
    for (const station of pending) {
      const sportId = ob.sportIds[station.sport]
      if (!sportId) continue
      try { await createStation(ob.venueId, sportId, station.name) } catch {}
    }
    setLoading(false)
    navigate('/onboarding/players')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Add your boards and tables</h1>
      <p className="text-gray-400 text-sm mb-8">You can rename these and add more in settings any time.</p>

      {/* Quick add */}
      <div className="mb-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Quick add</p>
        <div className="flex flex-wrap gap-2">
          {ob.sports.includes('darts') && (
            <>
              <button
                onClick={() => quickAdd('darts', 1)}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
              >
                + 1 Dart Board
              </button>
              <button
                onClick={() => quickAdd('darts', 2)}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
              >
                + 2 Dart Boards
              </button>
            </>
          )}
          {ob.sports.includes('pool') && (
            <>
              <button
                onClick={() => quickAdd('pool', 1)}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
              >
                + 1 Pool Table
              </button>
              <button
                onClick={() => quickAdd('pool', 2)}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
              >
                + 2 Pool Tables
              </button>
            </>
          )}
        </div>
      </div>

      {/* Station list */}
      {pending.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800 mb-5">
          {pending.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg shrink-0">{SPORT_ICON[s.sport] ?? '🎯'}</span>
              <input
                value={s.name}
                onChange={e => rename(s.id, e.target.value)}
                className="flex-1 bg-transparent text-white text-sm focus:outline-none border-b border-transparent focus:border-gray-600 py-0.5 transition-colors"
              />
              <button
                onClick={() => remove(s.id)}
                className="text-gray-600 hover:text-red-400 text-sm transition-colors shrink-0"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Custom add */}
      <div className="flex gap-2 mb-8">
        <input
          value={customName}
          onChange={e => setCustomName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCustom()}
          placeholder="Custom name"
          className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {ob.sports.length > 1 && (
          <select
            value={customSport}
            onChange={e => setCustomSport(e.target.value)}
            className="rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-white text-sm focus:outline-none"
          >
            {ob.sports.map(s => (
              <option key={s} value={s}>{SPORT_LABEL[s] ?? s}</option>
            ))}
          </select>
        )}
        <button
          onClick={addCustom}
          disabled={!customName.trim()}
          className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
        >
          Add
        </button>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => navigate('/onboarding/players')}
          className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={handleNext}
          disabled={loading}
          className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors"
        >
          {loading ? 'Saving…' : pending.length > 0 ? `Add ${pending.length} station${pending.length !== 1 ? 's' : ''}` : 'Continue'}
        </button>
      </div>
    </div>
  )
}

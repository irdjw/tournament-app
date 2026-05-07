import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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

const SPORTS = [
  {
    key: 'darts',
    label: 'Darts',
    icon: '🎯',
    features: ['501 & 301', 'Legs & sets', 'Averages & 180s', 'Tournaments & leagues'],
  },
  {
    key: 'pool',
    label: 'Pool',
    icon: '🎱',
    features: ['8-ball & 9-ball', 'Frames', 'League tables', 'Tournament brackets'],
  },
]

export default function OnboardingSport() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string[]>(['darts'])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!getOnboarding()) navigate('/onboarding', { replace: true })
  }, [navigate])

  function toggle(key: string) {
    setSelected(s => s.includes(key) ? s.filter(k => k !== key) : [...s, key])
  }

  async function handleNext() {
    if (selected.length === 0) return
    setLoading(true)

    const { data: existing } = await supabase
      .from('sports')
      .select('id, name')
      .in('name', selected)

    const sportIds: Record<string, string> = {}
    for (const s of existing ?? []) sportIds[s.name] = s.id

    for (const sport of selected) {
      if (!sportIds[sport]) {
        const { data: newSport } = await supabase
          .from('sports')
          .insert({ name: sport })
          .select('id')
          .single()
        if (newSport) sportIds[sport] = newSport.id
      }
    }

    const ob = getOnboarding()!
    sessionStorage.setItem('onboarding', JSON.stringify({ ...ob, sports: selected, sportIds }))
    setLoading(false)
    navigate('/onboarding/stations')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">What do you play?</h1>
      <p className="text-gray-400 text-sm mb-8">Select all that apply. You can change this in settings later.</p>

      <div className="space-y-3 mb-8">
        {SPORTS.map(sport => {
          const isSelected = selected.includes(sport.key)
          return (
            <button
              key={sport.key}
              onClick={() => toggle(sport.key)}
              className={`w-full flex items-start gap-4 px-5 py-4 rounded-2xl border-2 transition-all text-left ${
                isSelected
                  ? 'border-purple-500 bg-purple-900/20'
                  : 'border-gray-700 bg-gray-900 hover:border-gray-600'
              }`}
            >
              <span className="text-3xl mt-0.5">{sport.icon}</span>
              <div className="flex-1">
                <p className="font-semibold text-white text-sm mb-1.5">{sport.label}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {sport.features.map(f => (
                    <span key={f} className="text-xs text-gray-500">{f}</span>
                  ))}
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                isSelected ? 'border-purple-400 bg-purple-500' : 'border-gray-600'
              }`}>
                {isSelected && <span className="text-white text-xs leading-none">✓</span>}
              </div>
            </button>
          )
        })}

        <div className="flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-gray-800 bg-gray-900/30 text-left opacity-40 cursor-not-allowed select-none">
          <span className="text-3xl">🏓</span>
          <div>
            <p className="font-semibold text-gray-500 text-sm">More sports coming soon</p>
            <p className="text-xs text-gray-600 mt-0.5">Table tennis, snooker, and more</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleNext}
        disabled={selected.length === 0 || loading}
        className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors"
      >
        {loading ? 'Saving…' : 'Continue'}
      </button>
    </div>
  )
}

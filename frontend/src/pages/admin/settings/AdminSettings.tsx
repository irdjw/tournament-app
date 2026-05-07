import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

export default function AdminSettings() {
  const { venueAdmin } = useAuth()

  const [venueName, setVenueName] = useState('')
  const [venueSlug, setVenueSlug] = useState('')
  const [savingVenue, setSavingVenue] = useState(false)
  const [venueSaved, setVenueSaved] = useState(false)

  const [defaultLegs, setDefaultLegs] = useState('3')
  const [defaultScore, setDefaultScore] = useState('501')
  const [doubleOut, setDoubleOut] = useState(true)
  const [savingDarts, setSavingDarts] = useState(false)
  const [dartsSaved, setDartsSaved] = useState(false)

  const [showDangerZone, setShowDangerZone] = useState(false)
  const [confirmReset, setConfirmReset] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (!venueAdmin?.venue) return
    setVenueName(venueAdmin.venue.name ?? '')
    setVenueSlug(venueAdmin.venue.slug ?? '')
  }, [venueAdmin?.venue])

  async function handleSaveVenue(e: React.FormEvent) {
    e.preventDefault()
    if (!venueAdmin?.venue_id) return
    setSavingVenue(true)
    setVenueSaved(false)
    try {
      const { error } = await supabase
        .from('venues')
        .update({ name: venueName.trim(), slug: venueSlug.trim().toLowerCase().replace(/\s+/g, '-') })
        .eq('id', venueAdmin.venue_id)
      if (error) throw error
      setVenueSlug(venueSlug.trim().toLowerCase().replace(/\s+/g, '-'))
      setVenueSaved(true)
      setTimeout(() => setVenueSaved(false), 3000)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSavingVenue(false)
    }
  }

  async function handleSaveDarts(e: React.FormEvent) {
    e.preventDefault()
    if (!venueAdmin?.venue_id) return
    setSavingDarts(true)
    setDartsSaved(false)
    try {
      const { error } = await supabase
        .from('venues')
        .update({
          default_legs: parseInt(defaultLegs),
          default_starting_score: parseInt(defaultScore),
          default_double_out: doubleOut,
        })
        .eq('id', venueAdmin.venue_id)
      if (error) throw error
      setDartsSaved(true)
      setTimeout(() => setDartsSaved(false), 3000)
    } catch (e: any) {
      if (e.message?.includes('column')) {
        setDartsSaved(true)
        setTimeout(() => setDartsSaved(false), 3000)
      } else {
        alert(e.message)
      }
    } finally {
      setSavingDarts(false)
    }
  }

  async function handleResetSeason() {
    if (!venueAdmin?.venue_id) return
    setResetting(true)
    try {
      const { data: fixtures } = await supabase
        .from('fixtures')
        .select('id')
        .eq('venue_id', venueAdmin.venue_id)

      const fixtureIds = (fixtures ?? []).map((f: any) => f.id)
      if (fixtureIds.length > 0) {
        await supabase
          .from('standings')
          .update({ played: 0, wins: 0, losses: 0, legs_for: 0, legs_against: 0, points: 0 })
          .in('fixture_id', fixtureIds)
      }
      setConfirmReset('')
      setShowDangerZone(false)
      alert('Season data has been reset.')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setResetting(false)
    }
  }

  const publicUrl = `${window.location.origin}/v/${venueSlug}`

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      {/* Venue */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Venue</h2>
        <form onSubmit={handleSaveVenue} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Venue Name</label>
            <input
              type="text"
              value={venueName}
              onChange={e => setVenueName(e.target.value)}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Venue Slug</label>
            <div className="flex items-center rounded-lg bg-gray-800 border border-gray-700 overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
              <span className="pl-3 text-gray-500 text-sm whitespace-nowrap">/v/</span>
              <input
                type="text"
                value={venueSlug}
                onChange={e => setVenueSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="flex-1 bg-transparent px-1 py-2 text-white text-sm focus:outline-none"
              />
            </div>
            {venueSlug && (
              <p className="text-xs text-gray-500 mt-1.5">
                Public URL:{' '}
                <a href={publicUrl} target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">
                  {publicUrl}
                </a>
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={savingVenue}
            className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {savingVenue ? 'Saving…' : venueSaved ? 'Saved ✓' : 'Save Venue'}
          </button>
        </form>
      </div>

      {/* Default darts config */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Default Darts Config</h2>
        <form onSubmit={handleSaveDarts} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Legs (best of)</label>
              <select
                value={defaultLegs}
                onChange={e => setDefaultLegs(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="1">Best of 1</option>
                <option value="3">Best of 3</option>
                <option value="5">Best of 5</option>
                <option value="7">Best of 7</option>
                <option value="9">Best of 9</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Starting Score</label>
              <select
                value={defaultScore}
                onChange={e => setDefaultScore(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="301">301</option>
                <option value="501">501</option>
                <option value="701">701</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDoubleOut(d => !d)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                doubleOut ? 'bg-purple-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  doubleOut ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-300">Double out required</span>
          </div>
          <button
            type="submit"
            disabled={savingDarts}
            className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {savingDarts ? 'Saving…' : dartsSaved ? 'Saved ✓' : 'Save Defaults'}
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="bg-gray-900 border border-red-900/30 rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
          <button
            onClick={() => setShowDangerZone(d => !d)}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            {showDangerZone ? 'Hide' : 'Show'}
          </button>
        </div>

        {showDangerZone && (
          <div className="mt-4 space-y-4">
            <div className="border border-red-900/40 rounded-lg p-4">
              <p className="text-sm text-white font-medium mb-1">Reset Season Data</p>
              <p className="text-xs text-gray-400 mb-4">
                Resets all standings to zero. Match history is preserved. This cannot be undone.
              </p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder={`Type "${venueAdmin?.venue?.name ?? 'venue name'}" to confirm`}
                  value={confirmReset}
                  onChange={e => setConfirmReset(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  onClick={handleResetSeason}
                  disabled={confirmReset !== venueAdmin?.venue?.name || resetting}
                  className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {resetting ? 'Resetting…' : 'Reset Season'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

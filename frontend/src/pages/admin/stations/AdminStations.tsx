import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import { getStationsForVenue, clearStation, createStation } from '../../../lib/stations'
import type { Station } from '../../../lib/stations'

const STATUS_STYLE: Record<string, { label: string; dot: string; border: string }> = {
  available: { label: 'Available', dot: 'bg-green-400', border: 'border-green-800/30' },
  in_use:    { label: 'In Use',    dot: 'bg-yellow-400', border: 'border-yellow-800/30' },
  reserved:  { label: 'Reserved', dot: 'bg-blue-400',   border: 'border-blue-800/30' },
}

export default function AdminStations() {
  const { venueAdmin } = useAuth()
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [confirmClear, setConfirmClear] = useState<Station | null>(null)

  async function reload() {
    if (!venueAdmin?.venue_id) return
    try {
      setStations(await getStationsForVenue(venueAdmin.venue_id))
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => {
    reload()

    if (!venueAdmin?.venue_id) return

    const channel = supabase
      .channel('admin-stations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stations', filter: `venue_id=eq.${venueAdmin.venue_id}` },
        () => reload(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [venueAdmin?.venue_id])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!venueAdmin?.venue_id || !newName.trim()) return
    setAddLoading(true)
    try {
      const { data: sport } = await supabase
        .from('sports')
        .select('id')
        .eq('name', 'darts')
        .single()
      await createStation(venueAdmin.venue_id, sport?.id ?? '', newName.trim())
      setNewName('')
      setShowAdd(false)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setAddLoading(false)
    }
  }

  async function handleDelete(station: Station) {
    const { error } = await supabase.from('stations').delete().eq('id', station.id)
    if (error) alert(error.message)
  }

  async function handleClear(station: Station) {
    await clearStation(station.id)
    setConfirmClear(null)
  }

  const byStatus = (a: Station, b: Station) => {
    const order = { in_use: 0, reserved: 1, available: 2 }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3)
  }

  if (loading) {
    return <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Stations</h1>
          <p className="text-sm text-gray-400 mt-1">
            {stations.filter(s => s.status === 'in_use').length} of {stations.length} in use
            {' '}· Live updates
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
        >
          + Add Station
        </button>
      </div>

      {stations.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">No stations yet.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-3 inline-block text-purple-400 hover:text-purple-300 text-sm"
          >
            Add your first station →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...stations].sort(byStatus).map(station => {
            const style = STATUS_STYLE[station.status] ?? STATUS_STYLE.available
            const match = station.current_match
            const players = match?.match_players ?? []

            return (
              <div
                key={station.id}
                className={`bg-gray-900 border rounded-xl p-5 transition-colors ${style.border} border border-gray-800`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">{station.name}</h2>
                    {station.sport && (
                      <p className="text-xs text-gray-500 mt-0.5 capitalize">{station.sport.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <span className="text-xs text-gray-400">{style.label}</span>
                  </div>
                </div>

                {station.status === 'in_use' && match && players.length >= 2 && (
                  <div className="bg-gray-800 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white font-medium">{players[0]?.users?.name ?? '—'}</span>
                      <span className="text-gray-500 text-xs">vs</span>
                      <span className="text-white font-medium">{players[1]?.users?.name ?? '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                      <span>{players[0]?.legs_won ?? 0} legs</span>
                      <span>Leg {match.current_leg} of {match.legs_to_win ? match.legs_to_win * 2 - 1 : '?'}</span>
                      <span>{players[1]?.legs_won ?? 0} legs</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  {station.status === 'in_use' && (
                    <button
                      onClick={() => setConfirmClear(station)}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(station)}
                    className="text-xs py-1.5 px-3 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add station modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-4">Add Station</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Name *</label>
                <input
                  autoFocus
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Board 1"
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700">Cancel</button>
                <button type="submit" disabled={addLoading} className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50">
                  {addLoading ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm clear modal */}
      {confirmClear && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-2">Clear station?</h2>
            <p className="text-sm text-gray-400 mb-6">
              This will mark <strong className="text-white">{confirmClear.name}</strong> as available.
              The match will still be in progress.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClear(null)} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700">Cancel</button>
              <button onClick={() => handleClear(confirmClear)} className="flex-1 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium">Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

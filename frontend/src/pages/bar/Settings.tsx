import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import BarNav from '../../components/BarNav'
import { getAllStations, createStation } from '../../lib/stations'
import type { Station } from '../../lib/stations'

interface Venue {
  id: string
  name: string
}

interface Sport {
  id: string
  name: string
}

// ─── Rename modal ────────────────────────────────────────────────────────────

function RenameModal({
  station,
  onClose,
  onRenamed,
}: {
  station: Station
  onClose: () => void
  onRenamed: () => void
}) {
  const [name, setName] = useState(station.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name required'); return }
    setBusy(true)
    try {
      const { error: err } = await supabase
        .from('stations')
        .update({ name: name.trim() })
        .eq('id', station.id)
      if (err) throw err
      onRenamed()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
        <h3 className="font-bold text-lg mb-4">Rename Station</h3>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border rounded-lg p-2 mb-4 text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Add Station modal ────────────────────────────────────────────────────────

function AddStationModal({
  venueId,
  sports,
  onClose,
  onAdded,
}: {
  venueId: string
  sports: Sport[]
  onClose: () => void
  onAdded: () => void
}) {
  const [name, setName] = useState('')
  const [sportId, setSportId] = useState(sports[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name required'); return }
    if (!sportId) { setError('Select a sport'); return }
    setBusy(true)
    try {
      await createStation(venueId, sportId, name.trim())
      onAdded()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
        <h3 className="font-bold text-lg mb-4">Add Station</h3>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Board 1, Pool Table A"
            className="w-full border rounded-lg p-2 mb-3 text-sm"
            autoFocus
          />
          <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
          <select
            value={sportId}
            onChange={e => setSportId(e.target.value)}
            className="w-full border rounded-lg p-2 mb-4 text-sm"
          >
            {sports.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
              {busy ? 'Adding…' : 'Add'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG_KEY = 'defaultMatchConfig'

function loadDefaultConfig() {
  try {
    return JSON.parse(localStorage.getItem(DEFAULT_CONFIG_KEY) ?? 'null') ?? {
      legs: 3,
      startingScore: 501,
      doubleOut: true,
    }
  } catch {
    return { legs: 3, startingScore: 501, doubleOut: true }
  }
}

export default function Settings() {
  const [venue, setVenue] = useState<Venue | null>(null)
  const [sports, setSports] = useState<Sport[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [addingStation, setAddingStation] = useState(false)
  const [renamingStation, setRenamingStation] = useState<Station | null>(null)
  const [deletingStation, setDeletingStation] = useState<string | null>(null)
  const [defaultConfig, setDefaultConfig] = useState(loadDefaultConfig())
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    const [{ data: vData }, { data: sData }, stData] = await Promise.all([
      supabase.from('venues').select('id, name').limit(1).single(),
      supabase.from('sports').select('id, name').order('name'),
      getAllStations(),
    ])
    setVenue(vData as Venue ?? null)
    setSports((sData as Sport[]) ?? [])
    setStations(stData)
    setLoading(false)
  }

  const handleDeleteStation = async (id: string) => {
    if (!confirm('Delete this station?')) return
    setDeletingStation(id)
    try {
      const { error } = await supabase.from('stations').delete().eq('id', id)
      if (error) throw error
      await loadAll()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed')
    } finally {
      setDeletingStation(null)
    }
  }

  const toggleSport = async (sport: Sport) => {
    // Sports are always available — this would toggle venue-level sport preference.
    // For now we simply add a sport if it doesn't exist.
    alert(`Sport "${sport.name}" is active. To deactivate, remove it from the database directly.`)
  }

  const handleAddSport = async (name: string) => {
    const { error } = await supabase.from('sports').insert({ name: name.toLowerCase() })
    if (error) { alert(error.message); return }
    await loadAll()
  }

  const saveDefaultConfig = () => {
    localStorage.setItem(DEFAULT_CONFIG_KEY, JSON.stringify(defaultConfig))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        <BarNav />
        <div className="flex-1 flex items-center justify-center text-gray-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <BarNav />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-6 mt-2">Settings</h1>

        {/* Venue */}
        <section className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Venue</h2>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <label className="block text-sm text-gray-400 mb-1">Venue Name</label>
            <div className="text-white font-semibold">{venue?.name ?? '—'}</div>
            <p className="text-xs text-gray-500 mt-1">Venue name is managed via the database.</p>
          </div>
        </section>

        {/* Stations */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Stations</h2>
            {venue && (
              <button
                onClick={() => setAddingStation(true)}
                className="text-xs font-semibold bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded-lg transition-colors"
              >
                + Add
              </button>
            )}
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700 overflow-hidden">
            {stations.length === 0 && (
              <div className="p-4 text-gray-400 text-sm text-center">No stations yet.</div>
            )}
            {stations.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium text-sm">{s.name}</div>
                  {s.sport && <div className="text-xs text-gray-400 capitalize">{s.sport.name}</div>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRenamingStation(s)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDeleteStation(s.id)}
                    disabled={deletingStation === s.id}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    {deletingStation === s.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sports */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Sports</h2>
            <button
              onClick={() => {
                const name = prompt('Sport name (e.g. pool, darts):')
                if (name?.trim()) handleAddSport(name.trim())
              }}
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg transition-colors"
            >
              + Add
            </button>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700 overflow-hidden">
            {sports.length === 0 && (
              <div className="p-4 text-gray-400 text-sm text-center">No sports configured.</div>
            )}
            {sports.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium text-sm capitalize">{s.name}</span>
                <button
                  onClick={() => toggleSport(s)}
                  className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Active ✓
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Default match config */}
        <section className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Default Match Config</h2>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Legs to win</label>
              <select
                value={defaultConfig.legs}
                onChange={e => setDefaultConfig({ ...defaultConfig, legs: Number(e.target.value) })}
                className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 w-full"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>Best of {n * 2 - 1} ({n} leg{n > 1 ? 's' : ''})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Starting score</label>
              <div className="flex gap-2">
                {[301, 501].map(s => (
                  <button
                    key={s}
                    onClick={() => setDefaultConfig({ ...defaultConfig, startingScore: s })}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${defaultConfig.startingScore === s ? 'bg-amber-600 border-amber-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Double out</div>
                <div className="text-xs text-gray-400">Must finish on a double</div>
              </div>
              <button
                onClick={() => setDefaultConfig({ ...defaultConfig, doubleOut: !defaultConfig.doubleOut })}
                className={`relative w-10 h-6 rounded-full transition-colors ${defaultConfig.doubleOut ? 'bg-amber-600' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${defaultConfig.doubleOut ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
            <button
              onClick={saveDefaultConfig}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-semibold transition-colors"
            >
              {saved ? '✓ Saved' : 'Save Defaults'}
            </button>
          </div>
        </section>
      </div>

      {/* Modals */}
      {addingStation && venue && (
        <AddStationModal
          venueId={venue.id}
          sports={sports}
          onClose={() => setAddingStation(false)}
          onAdded={loadAll}
        />
      )}
      {renamingStation && (
        <RenameModal
          station={renamingStation}
          onClose={() => setRenamingStation(null)}
          onRenamed={loadAll}
        />
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Station, StationPlayer, UnassignedMatch,
  getAllStations, getStationsForVenue, assignMatchToStation, clearStation,
  createStation, getUnassignedMatches, getScoresForMatch,
} from '../../lib/stations'
import { useAuth } from '../../hooks/useAuth'
import BarNav from '../../components/BarNav'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS = {
  available: { label: 'Available', cls: 'bg-green-100 text-green-800 border border-green-300' },
  in_use:    { label: 'In Use',    cls: 'bg-red-100 text-red-800 border border-red-300' },
  reserved:  { label: 'Reserved',  cls: 'bg-amber-100 text-amber-800 border border-amber-300' },
}

// ─── Score display for one station ───────────────────────────────────────────

function MatchScores({ matchId, currentLeg, players }: { matchId: string; currentLeg: number; players: StationPlayer[] }) {
  const [scores, setScores] = useState<Record<string, number>>({})

  useEffect(() => {
    getScoresForMatch(matchId, currentLeg, players).then(setScores)

    const sub = supabase
      .channel(`scores-${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_events',
        filter: `match_id=eq.${matchId}` }, () => {
        getScoresForMatch(matchId, currentLeg, players).then(setScores)
      })
      .subscribe()

    return () => { sub.unsubscribe() }
  }, [matchId, currentLeg])

  return (
    <div className="flex justify-between mt-2">
      {players.map(p => (
        <div key={p.user_id} className="text-center flex-1">
          <div className="text-sm text-gray-500 truncate">{p.users.name}</div>
          <div className="text-2xl font-bold tabular-nums">{scores[p.user_id] ?? 501}</div>
          <div className="text-xs text-gray-400">leg {p.legs_won}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Assign modal ─────────────────────────────────────────────────────────────

function AssignModal({ stationId, onClose, onAssigned }: { stationId: string; onClose: () => void; onAssigned: () => void }) {
  const [matches, setMatches] = useState<UnassignedMatch[]>([])
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { venueAdmin } = useAuth()

  useEffect(() => {
    getUnassignedMatches(venueAdmin?.venue_id).then(setMatches)
  }, [venueAdmin?.venue_id])

  const label = (m: UnassignedMatch) =>
    m.match_players.map(p => p.users?.name).filter(Boolean).join(' vs ') || m.id.slice(0, 8)

  const handleAssign = async () => {
    if (!selected) { setError('Pick a match'); return }
    setBusy(true)
    try {
      await assignMatchToStation(selected, stationId)
      onAssigned()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80">
        <h3 className="font-bold text-lg mb-4">Assign Match</h3>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        {matches.length === 0 ? (
          <p className="text-gray-500 text-sm mb-4">No unassigned matches available.</p>
        ) : (
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full border rounded-lg p-2 mb-4 text-sm"
          >
            <option value="">Select a match…</option>
            {matches.map(m => (
              <option key={m.id} value={m.id}>{label(m)}</option>
            ))}
          </select>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleAssign}
            disabled={busy || !selected}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? 'Assigning…' : 'Assign'}
          </button>
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Station form ─────────────────────────────────────────────────────────

function AddStationForm({ onAdded, onClose }: { onAdded: () => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { venueAdmin } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name required'); return }
    setBusy(true)
    try {
      const { data: sport } = await supabase.from('sports').select('id').eq('name', 'darts').single()
      if (!venueAdmin?.venue_id) throw new Error('No venue linked to your account')
      if (!sport) throw new Error('Darts sport not found')
      await createStation(venueAdmin.venue_id, sport.id, name.trim())
      onAdded()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80">
        <h3 className="font-bold text-lg mb-4">Add Station</h3>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Board 1, Pool Table A"
            className="w-full border rounded-lg p-2 mb-4 text-sm"
            autoFocus
          />
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

// ─── Station card ─────────────────────────────────────────────────────────────

function StationCard({ station, onRefresh }: { station: Station; onRefresh: () => void }) {
  const [assigning, setAssigning] = useState(false)
  const [clearing, setClearing] = useState(false)

  const statusInfo = STATUS[station.status] ?? STATUS.available
  const match = station.current_match

  const handleClear = async () => {
    setClearing(true)
    try { await clearStation(station.id); onRefresh() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed') }
    finally { setClearing(false) }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-base">{station.name}</h3>
            {station.sport && <p className="text-xs text-gray-400 capitalize">{station.sport.name}</p>}
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
        </div>

        {/* Active match */}
        {station.status === 'in_use' && match && (
          <MatchScores
            matchId={match.id}
            currentLeg={match.current_leg}
            players={match.match_players}
          />
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-1">
          {station.status === 'available' && (
            <button
              onClick={() => setAssigning(true)}
              className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm font-semibold"
            >
              Assign Match
            </button>
          )}
          {station.status !== 'available' && (
            <button
              onClick={handleClear}
              disabled={clearing}
              className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-1.5 text-sm disabled:opacity-50"
            >
              {clearing ? 'Clearing…' : 'Clear'}
            </button>
          )}
        </div>
      </div>

      {assigning && (
        <AssignModal
          stationId={station.id}
          onClose={() => setAssigning(false)}
          onAssigned={onRefresh}
        />
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Stations() {
  const { venueAdmin } = useAuth()
  const venueId = venueAdmin?.venue_id
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [addingStation, setAddingStation] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    load()
    channelRef.current = supabase
      .channel('stations-bar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stations' }, load)
      .subscribe()
    return () => { channelRef.current?.unsubscribe() }
  }, [venueId])

  const load = async () => {
    try {
      const data = venueId ? await getStationsForVenue(venueId) : await getAllStations()
      setStations(data)
    } finally {
      setLoading(false)
    }
  }

  const available = stations.filter(s => s.status === 'available').length
  const inUse = stations.filter(s => s.status === 'in_use').length

  return (
    <>
    <BarNav />
    <div style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold m-0">Stations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {inUse} in use · {available} available
          </p>
        </div>
        <button
          onClick={() => setAddingStation(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          + Add Station
        </button>
      </div>

      {loading && <p className="text-center text-gray-500 py-8">Loading…</p>}

      {!loading && stations.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">🎯</div>
          <p>No stations yet. Add one to get started.</p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map(s => (
            <StationCard key={s.id} station={s} onRefresh={load} />
          ))}
        </div>
      )}

      {addingStation && (
        <AddStationForm onAdded={load} onClose={() => setAddingStation(false)} />
      )}
    </div>
    </>
  )
}

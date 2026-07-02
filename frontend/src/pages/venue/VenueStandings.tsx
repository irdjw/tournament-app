import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { getStandings } from '../../lib/fixtures'

const REFRESH_MS = 60_000

interface Fixture {
  id: string
  name: string
}

interface StandingRow {
  user: { id: string; name: string }
  played: number
  wins: number
  losses: number
  legs_for: number
  legs_against: number
  points: number
}

export default function VenueStandings() {
  const venue = useVenue()
  useDocumentTitle(`${venue.name} — Standings`)

  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selected, setSelected] = useState<string>('')
  const [standings, setStandings] = useState<StandingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showQR, setShowQR] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    supabase
      .from('fixtures')
      .select('id, name')
      .eq('venue_id', venue.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const items = (data ?? []) as Fixture[]
        setFixtures(items)
        if (items[0]) setSelected(items[0].id)
      })
  }, [venue.id])

  async function loadStandings(id: string) {
    setLoading(true)
    try {
      const data = await getStandings(id)
      // Supabase types embedded joins as arrays; runtime shape is an object
      setStandings(data as unknown as StandingRow[])
      setLastUpdated(new Date())
    } catch (_) {}
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!selected) return
    loadStandings(selected)
    timerRef.current = setInterval(() => loadStandings(selected), REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [selected])

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: `${venue.name} Standings`, url }) } catch (_) {}
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copied!')
    }
  }

  const currentFixtureName = fixtures.find(f => f.id === selected)?.name ?? 'Standings'

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Standings</h1>
          {lastUpdated && (
            <p className="text-xs text-gray-500 mt-1">
              Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · refreshes every minute
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowQR(q => !q)}
            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
            title="QR code for this page"
          >
            QR
          </button>
          <button
            onClick={handleShare}
            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
          >
            Share
          </button>
        </div>
      </div>

      {/* QR code */}
      {showQR && (
        <div className="flex flex-col items-center gap-3 bg-white rounded-2xl p-6 max-w-xs">
          <QRCodeSVG value={window.location.href} size={160} />
          <p className="text-gray-700 text-xs text-center break-all">{window.location.href}</p>
        </div>
      )}

      {/* Fixture selector */}
      {fixtures.length > 1 && (
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {fixtures.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      )}

      {loading && standings.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
      ) : standings.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center text-gray-500">
          No standings yet for {currentFixtureName}.
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white">{currentFixtureName}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500">
                  <th className="text-left px-5 py-3 font-medium w-8">Pos</th>
                  <th className="text-left px-5 py-3 font-medium">Player</th>
                  <th className="text-right px-3 py-3 font-medium">P</th>
                  <th className="text-right px-3 py-3 font-medium">W</th>
                  <th className="text-right px-3 py-3 font-medium">L</th>
                  <th className="text-right px-3 py-3 font-medium">+</th>
                  <th className="text-right px-3 py-3 font-medium">−</th>
                  <th className="text-right px-3 py-3 font-medium">+/−</th>
                  <th className="text-right px-5 py-3 font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => {
                  const diff = row.legs_for - row.legs_against
                  return (
                    <tr key={row.user?.id ?? i} className={`border-b border-gray-800/50 ${i < 3 ? 'bg-purple-900/5' : ''}`}>
                      <td className="px-5 py-3 text-gray-500 text-xs">{i + 1}</td>
                      <td className="px-5 py-3 text-white font-medium">{row.user?.name ?? '—'}</td>
                      <td className="px-3 py-3 text-right text-gray-400">{row.played}</td>
                      <td className="px-3 py-3 text-right text-gray-400">{row.wins}</td>
                      <td className="px-3 py-3 text-right text-gray-400">{row.losses}</td>
                      <td className="px-3 py-3 text-right text-gray-400">{row.legs_for}</td>
                      <td className="px-3 py-3 text-right text-gray-400">{row.legs_against}</td>
                      <td className={`px-3 py-3 text-right font-medium ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {diff > 0 ? '+' : ''}{diff}
                      </td>
                      <td className="px-5 py-3 text-right text-purple-300 font-bold">{row.points}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

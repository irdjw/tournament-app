import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getFixture, getStandings } from '../lib/fixtures'

const REFRESH_INTERVAL = 30_000

export default function StandingsPublic() {
  const { fixtureId } = useParams()
  const [fixture, setFixture] = useState(null)
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    loadAll()
    timerRef.current = setInterval(loadStandings, REFRESH_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [fixtureId])

  const loadAll = async () => {
    try {
      const [fix, table] = await Promise.all([getFixture(fixtureId), getStandings(fixtureId)])
      setFixture(fix)
      setStandings(table)
      setLastUpdated(new Date())
    } catch (_) {
      // silently fail on refresh
    } finally {
      setLoading(false)
    }
  }

  const loadStandings = async () => {
    try {
      const table = await getStandings(fixtureId)
      setStandings(table)
      setLastUpdated(new Date())
    } catch (_) {}
  }

  if (loading) {
    return (
      <div style={centerStyle}>
        <div style={{ fontSize: '1.25rem', color: '#666' }}>Loading standings...</div>
      </div>
    )
  }

  const legDiff = (row) => row.legs_for - row.legs_against
  const formattedTime = lastUpdated?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#111', color: 'white', padding: '1.5rem' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🎯</div>
          <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.25rem', fontWeight: 'bold' }}>
            {fixture?.name ?? 'League Standings'}
          </h1>
          {lastUpdated && (
            <p style={{ color: '#888', fontSize: '0.8rem', margin: 0 }}>Updated {formattedTime} · refreshes every 30s</p>
          )}
        </div>

        {standings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666', fontSize: '1.1rem' }}>
            No matches played yet
          </div>
        ) : (
          <>
            {/* Mobile-friendly table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #444' }}>
                    {['Pos', 'Player', 'P', 'W', 'L', 'LF', 'LA', '+/-', 'Pts'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => {
                    const diff = legDiff(row)
                    const isTop3 = i < 3
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid #222', backgroundColor: i === 0 ? '#1a2a1a' : 'transparent' }}>
                        <td style={{ ...tdStyle, color: isTop3 ? '#4CAF50' : '#aaa', fontWeight: 'bold' }}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'left', color: 'white' }}>
                          {i === 0 && <span style={{ marginRight: '0.35rem' }}>👑</span>}
                          {row.user?.name ?? '—'}
                        </td>
                        <td style={{ ...tdStyle, color: '#aaa' }}>{row.played}</td>
                        <td style={{ ...tdStyle, color: '#4CAF50', fontWeight: 'bold' }}>{row.wins}</td>
                        <td style={{ ...tdStyle, color: '#ef5350' }}>{row.losses}</td>
                        <td style={{ ...tdStyle, color: '#aaa' }}>{row.legs_for}</td>
                        <td style={{ ...tdStyle, color: '#aaa' }}>{row.legs_against}</td>
                        <td style={{ ...tdStyle, fontWeight: 'bold', color: diff > 0 ? '#4CAF50' : diff < 0 ? '#ef5350' : '#888' }}>
                          {diff > 0 ? '+' : ''}{diff}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 'bold', fontSize: '1rem', color: '#4CAF50' }}>{row.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', fontSize: '0.75rem', color: '#666', flexWrap: 'wrap' }}>
              <span>P = Played</span>
              <span>W = Won</span>
              <span>L = Lost</span>
              <span>LF / LA = Legs For / Against</span>
              <span>Pts = Points (W=2, L=0)</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const centerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#111' }
const thStyle = { padding: '0.6rem 0.5rem', textAlign: 'center', color: '#aaa', fontWeight: 'bold', whiteSpace: 'nowrap' }
const tdStyle = { padding: '0.7rem 0.5rem', textAlign: 'center' }

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getFixture, getStandings, createFixtureRound, getNextRoundNumber } from '../../../lib/fixtures'
import BarNav from '../../../components/BarNav'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function FixtureDetail() {
  const { fixtureId } = useParams()
  const navigate = useNavigate()
  const [fixture, setFixture] = useState(null)
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const [fix, table] = await Promise.all([getFixture(fixtureId), getStandings(fixtureId)])
      setFixture(fix)
      setStandings(table)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [fixtureId])

  const handleStartRound = async () => {
    setStarting(true)
    setError('')
    try {
      const roundNumber = await getNextRoundNumber(fixtureId)
      const today = new Date().toISOString().split('T')[0]
      const round = await createFixtureRound(fixtureId, roundNumber, today)
      navigate(`/bar/league/round/${round.id}`)
    } catch (err) {
      setError(err.message || 'Failed to start round')
      setStarting(false)
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!fixture) return <div style={{ padding: '2rem' }}>Fixture not found.</div>

  const legDiff = (row) => row.legs_for - row.legs_against

  return (
    <>
    <BarNav />
    <div style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{fixture.name}</h1>
        <p style={{ color: '#666', margin: 0 }}>
          Every {DAY_NAMES[fixture.day_of_week] ?? '—'} · {fixture.start_time ?? ''}
        </p>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', marginBottom: '1rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <button onClick={handleStartRound} disabled={starting} style={startBtnStyle(starting)}>
        {starting ? 'Starting...' : "Start Tonight's Round"}
      </button>

      {/* Standings */}
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Standings</h2>

        {standings.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f9f9f9', borderRadius: '8px', color: '#666' }}>
            No matches played yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#333', color: 'white' }}>
                  {['#', 'Player', 'P', 'W', 'L', 'LF', 'LA', '+/-', 'Pts'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => {
                  const diff = legDiff(row)
                  return (
                    <tr key={row.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f9f9f9', borderBottom: '1px solid #eee' }}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'left' }}>{row.user?.name ?? '—'}</td>
                      <td style={tdStyle}>{row.played}</td>
                      <td style={{ ...tdStyle, color: '#4CAF50', fontWeight: 'bold' }}>{row.wins}</td>
                      <td style={{ ...tdStyle, color: '#f44336' }}>{row.losses}</td>
                      <td style={tdStyle}>{row.legs_for}</td>
                      <td style={tdStyle}>{row.legs_against}</td>
                      <td style={{ ...tdStyle, fontWeight: 'bold', color: diff > 0 ? '#4CAF50' : diff < 0 ? '#f44336' : '#666' }}>
                        {diff > 0 ? '+' : ''}{diff}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 'bold', fontSize: '1rem', color: '#4CAF50' }}>{row.points}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Public link */}
      <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f0f4f8', borderRadius: '6px', fontSize: '0.85rem', color: '#555' }}>
        Public standings link: <a href={`/standings/${fixtureId}`} style={{ color: '#4CAF50' }}>/standings/{fixtureId}</a>
      </div>
    </div>
    </>
  )
}

const startBtnStyle = (disabled) => ({
  padding: '0.875rem 1.5rem', fontSize: '1.1rem', fontWeight: 'bold',
  backgroundColor: disabled ? '#ccc' : '#4CAF50', color: 'white',
  border: 'none', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer',
  width: '100%',
})
const thStyle = { padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }
const tdStyle = { padding: '0.65rem 0.5rem', textAlign: 'center' }

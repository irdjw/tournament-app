import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { getFixtureRound, getPairingsForRound, createPairing, completeRound } from '../../../lib/fixtures'
import BarNav from '../../../components/BarNav'

const STATUS_LABEL = { pending: 'Not Started', in_progress: 'In Progress', complete: 'Complete' }
const STATUS_COLOR = { pending: '#888', in_progress: '#f5a623', complete: '#4CAF50' }

export default function RoundDetail() {
  const { roundId } = useParams()
  const navigate = useNavigate()
  const [round, setRound] = useState(null)
  const [pairings, setPairings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ending, setEnding] = useState(false)

  const [showAddForm, setShowAddForm] = useState(false)
  const [homePlayerName, setHomePlayerName] = useState('')
  const [awayPlayerName, setAwayPlayerName] = useState('')
  const [station, setStation] = useState('')
  const [legsToWin, setLegsToWin] = useState(2)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const channelRef = useRef(null)

  useEffect(() => {
    loadAll()
    subscribeToUpdates()
    return () => { channelRef.current?.unsubscribe() }
  }, [roundId])

  const loadAll = async () => {
    try {
      const [roundData, pairingsData] = await Promise.all([
        getFixtureRound(roundId),
        getPairingsForRound(roundId),
      ])
      setRound(roundData)
      setPairings(pairingsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const subscribeToUpdates = () => {
    channelRef.current = supabase
      .channel(`round-${roundId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => {
        getPairingsForRound(roundId).then(setPairings)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fixture_pairings' }, () => {
        getPairingsForRound(roundId).then(setPairings)
      })
      .subscribe()
  }

  const handleAddPairing = async (e) => {
    e.preventDefault()
    setAddError('')
    if (!homePlayerName.trim() || !awayPlayerName.trim()) {
      setAddError('Both player names are required')
      return
    }
    if (homePlayerName.trim().toLowerCase() === awayPlayerName.trim().toLowerCase()) {
      setAddError('Players must be different')
      return
    }
    setAdding(true)
    try {
      await createPairing(roundId, homePlayerName.trim(), awayPlayerName.trim(), station.trim(), legsToWin)
      setHomePlayerName('')
      setAwayPlayerName('')
      setStation('')
      setShowAddForm(false)
      const updated = await getPairingsForRound(roundId)
      setPairings(updated)
    } catch (err) {
      setAddError(err.message || 'Failed to add pairing')
    } finally {
      setAdding(false)
    }
  }

  const handleEndRound = async () => {
    setEnding(true)
    try {
      await completeRound(roundId)
      navigate(`/bar/league/${round.fixture_id}`)
    } catch (err) {
      setError(err.message || 'Failed to end round')
      setEnding(false)
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const allComplete = pairings.length > 0 && pairings.every(p => p.match?.status === 'complete')
  const roundComplete = round?.status === 'complete'

  return (
    <>
    <BarNav />
    <div style={{ padding: '1.5rem', maxWidth: '700px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to={`/bar/league/${round?.fixture?.id ?? round?.fixture_id}`} style={{ color: '#4CAF50', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← {round?.fixture?.name ?? 'Back to League'}
        </Link>
        <h1 style={{ fontSize: '1.75rem', margin: '0.5rem 0 0.25rem' }}>
          Round {round?.round_number}
        </h1>
        <p style={{ color: '#666', margin: 0 }}>{round?.played_on}</p>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', marginBottom: '1rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {/* Pairings list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {pairings.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f9f9f9', borderRadius: '8px', color: '#666' }}>
            No matches added yet
          </div>
        )}
        {pairings.map((p) => {
          const status = p.match?.status ?? 'pending'
          return (
            <div key={p.id} style={cardStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                  {p.home_player?.name ?? '?'} <span style={{ color: '#888', fontWeight: 'normal' }}>vs</span> {p.away_player?.name ?? '?'}
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#666' }}>
                  <span style={{ color: STATUS_COLOR[status], fontWeight: 'bold' }}>
                    ● {STATUS_LABEL[status] ?? status}
                  </span>
                  {p.station && <span>Board: {p.station}</span>}
                </div>
              </div>
              {status !== 'complete' && p.match_id && (
                <Link
                  to={`/bar/scoring/${p.match_id}`}
                  style={scoreBtnStyle}
                >
                  Score
                </Link>
              )}
              {status === 'complete' && (
                <span style={{ fontSize: '1.25rem' }}>✓</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Add pairing */}
      {!roundComplete && (
        <div style={{ marginBottom: '1.5rem' }}>
          {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)} style={addBtnStyle}>
              + Add Match
            </button>
          ) : (
            <div style={{ padding: '1.25rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fafafa' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>Add Match</h3>
              {addError && (
                <div style={{ padding: '0.5rem', marginBottom: '0.75rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', fontSize: '0.9rem' }}>
                  {addError}
                </div>
              )}
              <form onSubmit={handleAddPairing}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={smallLabelStyle}>Home Player</label>
                    <input value={homePlayerName} onChange={e => setHomePlayerName(e.target.value)} placeholder="Name" style={smallInputStyle} />
                  </div>
                  <div>
                    <label style={smallLabelStyle}>Away Player</label>
                    <input value={awayPlayerName} onChange={e => setAwayPlayerName(e.target.value)} placeholder="Name" style={smallInputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={smallLabelStyle}>Board / Station</label>
                    <input value={station} onChange={e => setStation(e.target.value)} placeholder="e.g. Board 1" style={smallInputStyle} />
                  </div>
                  <div>
                    <label style={smallLabelStyle}>Format</label>
                    <select value={legsToWin} onChange={e => setLegsToWin(parseInt(e.target.value))} style={smallInputStyle}>
                      <option value={1}>Single leg</option>
                      <option value={2}>Best of 3</option>
                      <option value={3}>Best of 5</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" disabled={adding} style={{ ...smallBtnStyle, backgroundColor: adding ? '#ccc' : '#4CAF50' }}>
                    {adding ? 'Adding...' : 'Add'}
                  </button>
                  <button type="button" onClick={() => { setShowAddForm(false); setAddError('') }} style={{ ...smallBtnStyle, backgroundColor: '#888' }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* End round */}
      {!roundComplete && allComplete && (
        <button onClick={handleEndRound} disabled={ending} style={endBtnStyle(ending)}>
          {ending ? 'Ending...' : 'End Round'}
        </button>
      )}

      {roundComplete && (
        <div style={{ padding: '1rem', backgroundColor: '#e8f5e9', borderRadius: '6px', textAlign: 'center', color: '#2e7d32', fontWeight: 'bold' }}>
          Round complete
        </div>
      )}
    </div>
    </>
  )
}

const cardStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '1rem 1.25rem', backgroundColor: 'white', border: '1px solid #e0e0e0',
  borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}
const scoreBtnStyle = {
  padding: '0.5rem 1rem', backgroundColor: '#1976d2', color: 'white',
  borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap',
}
const addBtnStyle = {
  width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 'bold',
  backgroundColor: 'white', color: '#333', border: '2px dashed #ccc',
  borderRadius: '6px', cursor: 'pointer',
}
const endBtnStyle = (disabled) => ({
  width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold',
  backgroundColor: disabled ? '#ccc' : '#e53935', color: 'white',
  border: 'none', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer',
})
const smallLabelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem', color: '#444' }
const smallInputStyle = {
  width: '100%', padding: '0.5rem', fontSize: '0.9rem',
  border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', backgroundColor: 'white',
}
const smallBtnStyle = {
  padding: '0.5rem 1.25rem', fontSize: '0.9rem', fontWeight: 'bold',
  color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer',
}

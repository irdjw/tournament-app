import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createFixture } from '../../../lib/fixtures'
import { useAuth } from '../../../hooks/useAuth'
import BarNav from '../../../components/BarNav'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function LeagueSetup() {
  const navigate = useNavigate()
  const { venueAdmin } = useAuth()
  const [name, setName] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(3) // Wednesday
  const [startTime, setStartTime] = useState('19:30')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Fixture name is required'); return }
    setLoading(true)
    try {
      const fixture = await createFixture(name.trim(), dayOfWeek, startTime, venueAdmin?.venue_id)
      navigate(`/bar/league/${fixture.id}`)
    } catch (err) {
      setError(err.message || 'Failed to create fixture')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <BarNav />
    <div style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>New League</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>Set up a recurring league night</p>

      {error && (
        <div style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>League Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tuesday Darts League"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>Night of the Week</label>
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(parseInt(e.target.value))} style={inputStyle}>
            {DAY_NAMES.map((day, i) => (
              <option key={i} value={i}>{day}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={labelStyle}>Start Time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button type="submit" disabled={loading} style={btnStyle(loading)}>
          {loading ? 'Creating...' : 'Create League'}
        </button>
      </form>
    </div>
    </>
  )
}

const labelStyle = { display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.95rem' }
const inputStyle = {
  width: '100%', padding: '0.75rem', fontSize: '1rem',
  border: '2px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', backgroundColor: 'white',
}
const btnStyle = (disabled) => ({
  width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold',
  backgroundColor: disabled ? '#ccc' : '#4CAF50', color: 'white',
  border: 'none', borderRadius: '4px', cursor: disabled ? 'not-allowed' : 'pointer',
})

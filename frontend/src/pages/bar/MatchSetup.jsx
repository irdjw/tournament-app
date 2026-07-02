import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { assignMatchToStation } from '../../lib/stations'
import { getOrCreatePlayer } from '../../lib/players'
import { useAuth } from '../../hooks/useAuth'
import BarNav from '../../components/BarNav'

export default function MatchSetup() {
  const navigate = useNavigate()
  const { venueAdmin } = useAuth()
  const [loading, setLoading] = useState(false)
  const [player1Name, setPlayer1Name] = useState('')
  const [player2Name, setPlayer2Name] = useState('')
  const [legsToWin, setLegsToWin] = useState(3)
  const [error, setError] = useState('')
  const [stations, setStations] = useState([])
  const [selectedStation, setSelectedStation] = useState('')

  useEffect(() => {
    let query = supabase
      .from('stations')
      .select('id, name, sport:sport_id(name)')
      .eq('status', 'available')
      .order('name')
    // Only this venue's stations once the admin record has loaded
    if (venueAdmin?.venue_id) query = query.eq('venue_id', venueAdmin.venue_id)
    query.then(({ data }) => setStations(data || []))
  }, [venueAdmin?.venue_id])

  const handleCreateMatch = async (e) => {
    e.preventDefault()
    setError('')

    if (!player1Name.trim() || !player2Name.trim()) {
      setError('Both player names are required')
      return
    }

    setLoading(true)

    try {
      // Create or get players (shared helper — same identity rules everywhere)
      const [player1Data, player2Data] = await Promise.all([
        getOrCreatePlayer(player1Name),
        getOrCreatePlayer(player2Name),
      ])

      // Get darts sport (or create it)
      let { data: sport } = await supabase
        .from('sports')
        .select()
        .eq('name', 'darts')
        .single()

      if (!sport) {
        const { data: newSport, error: sportError } = await supabase
          .from('sports')
          .insert({ name: 'darts' })
          .select()
          .single()

        if (sportError) throw sportError
        sport = newSport
      }

      // Create match, stamped with the staff member's venue
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
          venue_id: venueAdmin?.venue_id ?? null,
          sport_id: sport.id,
          match_type: 'casual',
          status: 'in_progress',
          legs_to_win: legsToWin,
          current_leg: 1
        })
        .select()
        .single()

      if (matchError) throw matchError

      // Add players to match
      const { error: mp1Error } = await supabase
        .from('match_players')
        .insert({
          match_id: match.id,
          user_id: player1Data.id,
          team_id: 'team_a'
        })

      if (mp1Error) throw mp1Error

      const { error: mp2Error } = await supabase
        .from('match_players')
        .insert({
          match_id: match.id,
          user_id: player2Data.id,
          team_id: 'team_b'
        })

      if (mp2Error) throw mp2Error

      // Assign to station if selected
      if (selectedStation) {
        await assignMatchToStation(match.id, selectedStation)
      }

      // Navigate to scoring page
      navigate(`/bar/scoring/${match.id}`)
    } catch (err) {
      console.error('Error creating match:', err)
      setError(err.message || 'Failed to create match')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <BarNav />
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Create Darts Match</h1>

      {error && (
        <div style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleCreateMatch}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Player 1 Name:
          </label>
          <input
            type="text"
            value={player1Name}
            onChange={(e) => setPlayer1Name(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1.1rem',
              border: '2px solid #ccc',
              borderRadius: '4px'
            }}
            placeholder="Enter player name"
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Player 2 Name:
          </label>
          <input
            type="text"
            value={player2Name}
            onChange={(e) => setPlayer2Name(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1.1rem',
              border: '2px solid #ccc',
              borderRadius: '4px'
            }}
            placeholder="Enter player name"
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Match Format:
          </label>
          <select
            value={legsToWin}
            onChange={(e) => setLegsToWin(parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1.1rem',
              border: '2px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white'
            }}
          >
            <option value={1}>Single Leg (First to 1)</option>
            <option value={2}>Best of 3 (First to 2)</option>
            <option value={3}>Best of 5 (First to 3)</option>
            <option value={4}>Best of 7 (First to 4)</option>
            <option value={5}>Best of 9 (First to 5)</option>
          </select>
        </div>

        {stations.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Station (optional):
            </label>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1.1rem',
                border: '2px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white'
              }}
            >
              <option value="">No station</option>
              {stations.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.sport ? ` (${s.sport.name})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            backgroundColor: loading ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Creating...' : 'Start Match'}
        </button>
      </form>
    </div>
    </>
  )
}

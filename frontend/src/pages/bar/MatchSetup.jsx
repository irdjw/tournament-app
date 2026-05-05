import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function MatchSetup() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [player1Name, setPlayer1Name] = useState('')
  const [player2Name, setPlayer2Name] = useState('')
  const [legsToWin, setLegsToWin] = useState(3)
  const [error, setError] = useState('')

  const handleCreateMatch = async (e) => {
    e.preventDefault()
    setError('')

    if (!player1Name.trim() || !player2Name.trim()) {
      setError('Both player names are required')
      return
    }

    setLoading(true)

    try {
      // Create or get players
      const { data: player1Data, error: p1Error } = await supabase
        .from('users')
        .upsert({ name: player1Name, email: `${player1Name.toLowerCase().replace(/\s+/g, '')}@temp.com` }, { onConflict: 'email' })
        .select()
        .single()

      if (p1Error) throw p1Error

      const { data: player2Data, error: p2Error } = await supabase
        .from('users')
        .upsert({ name: player2Name, email: `${player2Name.toLowerCase().replace(/\s+/g, '')}@temp.com` }, { onConflict: 'email' })
        .select()
        .single()

      if (p2Error) throw p2Error

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

      // Create match
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
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
  )
}

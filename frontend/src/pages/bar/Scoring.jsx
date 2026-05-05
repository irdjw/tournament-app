import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const STARTING_SCORE = 501

export default function Scoring() {
  const { matchId } = useParams()
  const navigate = useNavigate()

  const [match, setMatch] = useState(null)
  const [players, setPlayers] = useState([])
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [scores, setScores] = useState({})
  const [visitHistory, setVisitHistory] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMatch()
  }, [matchId])

  const loadMatch = async () => {
    try {
      // Load match
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single()

      if (matchError) throw matchError
      setMatch(matchData)

      // Load players
      const { data: playersData, error: playersError } = await supabase
        .from('match_players')
        .select('*, users(*)')
        .eq('match_id', matchId)

      if (playersError) throw playersError
      setPlayers(playersData)

      // Initialize scores
      const initialScores = {}
      playersData.forEach(p => {
        initialScores[p.user_id] = STARTING_SCORE
      })
      setScores(initialScores)

      // Load existing events
      const { data: eventsData } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })

      if (eventsData && eventsData.length > 0) {
        // Rebuild state from events
        const history = []
        const currentScores = { ...initialScores }

        eventsData.forEach(event => {
          history.push(event)
          currentScores[event.user_id] = event.remaining_score
        })

        setVisitHistory(history)
        setScores(currentScores)
        setCurrentPlayerIndex(eventsData.length % playersData.length)
      }

      setLoading(false)
    } catch (err) {
      console.error('Error loading match:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  const handleNumberClick = (num) => {
    if (inputValue.length < 3) {
      setInputValue(inputValue + num)
    }
  }

  const handleClear = () => {
    setInputValue('')
  }

  const handleUndo = async () => {
    if (visitHistory.length === 0) return

    const lastEvent = visitHistory[visitHistory.length - 1]

    try {
      // Delete last event from database
      const { error } = await supabase
        .from('match_events')
        .delete()
        .eq('id', lastEvent.id)

      if (error) throw error

      // Update local state
      const newHistory = visitHistory.slice(0, -1)
      setVisitHistory(newHistory)

      // Recalculate scores
      const newScores = {}
      players.forEach(p => {
        newScores[p.user_id] = STARTING_SCORE
      })

      newHistory.forEach(event => {
        newScores[event.user_id] = event.remaining_score
      })

      setScores(newScores)
      setCurrentPlayerIndex((currentPlayerIndex - 1 + players.length) % players.length)
      setInputValue('')
    } catch (err) {
      console.error('Error undoing:', err)
      setError(err.message)
    }
  }

  const handleSubmit = async () => {
    const scoreValue = parseInt(inputValue)

    if (isNaN(scoreValue) || scoreValue < 0 || scoreValue > 180) {
      setError('Invalid score (0-180)')
      return
    }

    const currentPlayer = players[currentPlayerIndex]
    const currentScore = scores[currentPlayer.user_id]
    const newScore = currentScore - scoreValue

    // Bust validation
    if (newScore < 0 || newScore === 1) {
      setError('BUST! Score resets.')
      setInputValue('')

      // Log bust event
      const { error: bustError } = await supabase
        .from('match_events')
        .insert({
          match_id: matchId,
          user_id: currentPlayer.user_id,
          event_type: 'visit',
          visit_number: visitHistory.filter(e => e.user_id === currentPlayer.user_id).length + 1,
          score_value: scoreValue,
          remaining_score: currentScore,
          metadata: { bust: true }
        })

      if (bustError) console.error('Error logging bust:', bustError)

      // Move to next player
      setCurrentPlayerIndex((currentPlayerIndex + 1) % players.length)
      setTimeout(() => setError(''), 2000)
      return
    }

    // Check for win
    if (newScore === 0) {
      try {
        // Log winning visit
        const { data: eventData, error: eventError } = await supabase
          .from('match_events')
          .insert({
            match_id: matchId,
            user_id: currentPlayer.user_id,
            event_type: 'visit',
            visit_number: visitHistory.filter(e => e.user_id === currentPlayer.user_id).length + 1,
            score_value: scoreValue,
            remaining_score: 0,
            metadata: { checkout: true }
          })
          .select()
          .single()

        if (eventError) throw eventError

        // Update match status
        await supabase
          .from('matches')
          .update({ status: 'complete', completed_at: new Date().toISOString() })
          .eq('id', matchId)

        alert(`${currentPlayer.users.name} wins!`)
        navigate('/bar/match-setup')
        return
      } catch (err) {
        console.error('Error completing match:', err)
        setError(err.message)
        return
      }
    }

    // Normal visit
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('match_events')
        .insert({
          match_id: matchId,
          user_id: currentPlayer.user_id,
          event_type: 'visit',
          visit_number: visitHistory.filter(e => e.user_id === currentPlayer.user_id).length + 1,
          score_value: scoreValue,
          remaining_score: newScore
        })
        .select()
        .single()

      if (eventError) throw eventError

      // Update local state
      setScores({
        ...scores,
        [currentPlayer.user_id]: newScore
      })
      setVisitHistory([...visitHistory, eventData])
      setCurrentPlayerIndex((currentPlayerIndex + 1) % players.length)
      setInputValue('')
      setError('')
    } catch (err) {
      console.error('Error submitting score:', err)
      setError(err.message)
    }
  }

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading match...</div>
  }

  if (!match || players.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Match not found</div>
  }

  const currentPlayer = players[currentPlayerIndex]

  return (
    <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Darts Scoring</h1>

      {/* Player Scores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        {players.map((player, idx) => (
          <div
            key={player.id}
            style={{
              padding: '1.5rem',
              border: idx === currentPlayerIndex ? '3px solid #4CAF50' : '2px solid #ccc',
              borderRadius: '8px',
              textAlign: 'center',
              backgroundColor: idx === currentPlayerIndex ? '#f0fff0' : 'white'
            }}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {player.users.name}
            </div>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#333' }}>
              {scores[player.user_id]}
            </div>
          </div>
        ))}
      </div>

      {/* Current Turn */}
      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
          <strong>{currentPlayer.users.name}'s</strong> turn
        </div>
        <div style={{ fontSize: '2.5rem', fontWeight: 'bold', minHeight: '60px' }}>
          {inputValue || '—'}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#fee',
          border: '2px solid #f00',
          borderRadius: '4px',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          {error}
        </div>
      )}

      {/* Keypad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            onClick={() => handleNumberClick(num.toString())}
            style={{
              padding: '1.5rem',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              backgroundColor: '#e0e0e0',
              border: '2px solid #999',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            {num}
          </button>
        ))}
        <button
          onClick={handleClear}
          style={{
            padding: '1.5rem',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            backgroundColor: '#ff9800',
            color: 'white',
            border: '2px solid #f57c00',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
        <button
          onClick={() => handleNumberClick('0')}
          style={{
            padding: '1.5rem',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            backgroundColor: '#e0e0e0',
            border: '2px solid #999',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          0
        </button>
        <button
          onClick={handleSubmit}
          style={{
            padding: '1.5rem',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: '2px solid #388E3C',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Submit
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <button
          onClick={handleUndo}
          disabled={visitHistory.length === 0}
          style={{
            padding: '1rem',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            backgroundColor: visitHistory.length === 0 ? '#ccc' : '#ff5722',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: visitHistory.length === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          Undo Last
        </button>
        <button
          onClick={() => navigate('/bar/match-setup')}
          style={{
            padding: '1rem',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          New Match
        </button>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { clearStationByMatchId } from '../../lib/stations'
import { getCheckout } from '../../lib/darts'
import {
  DEFAULT_SCORING_CONFIG,
  evaluateVisit,
  getScoringConfigForMatch,
  rebuildLegState,
} from '../../lib/scoring'

export default function Scoring() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo')

  const [match, setMatch] = useState(null)
  const [config, setConfig] = useState(DEFAULT_SCORING_CONFIG)
  const [players, setPlayers] = useState([])
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [scores, setScores] = useState({})
  const [currentLeg, setCurrentLeg] = useState(1)
  const [visitHistory, setVisitHistory] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMatch()
  }, [matchId])

  async function loadMatch() {
    try {
      // Load match and its scoring rules (tournament config or defaults)
      const [{ data: matchData, error: matchError }, matchConfig] = await Promise.all([
        supabase.from('matches').select('*').eq('id', matchId).single(),
        getScoringConfigForMatch(matchId),
      ])

      if (matchError) throw matchError
      setMatch(matchData)
      setConfig(matchConfig)
      const leg = matchData.current_leg || 1
      setCurrentLeg(leg)

      // Load players
      const { data: playersData, error: playersError } = await supabase
        .from('match_players')
        .select('*, users(*)')
        .eq('match_id', matchId)

      if (playersError) throw playersError
      setPlayers(playersData)

      // Load existing events for current leg and rebuild state
      const { data: eventsData } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', matchId)
        .eq('leg_number', leg)
        .order('created_at', { ascending: true })

      const events = eventsData ?? []
      const state = rebuildLegState(events, playersData.map(p => p.user_id), leg, matchConfig)
      setVisitHistory(events)
      setScores(state.scores)
      setCurrentPlayerIndex(state.currentPlayerIndex)

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

      // Rebuild state without the undone event
      const newHistory = visitHistory.slice(0, -1)
      const state = rebuildLegState(newHistory, players.map(p => p.user_id), currentLeg, config)
      setVisitHistory(newHistory)
      setScores(state.scores)
      setCurrentPlayerIndex(state.currentPlayerIndex)
      setInputValue('')
    } catch (err) {
      console.error('Error undoing:', err)
      setError(err.message)
    }
  }

  const handleSubmit = async () => {
    const scoreValue = parseInt(inputValue)

    const currentPlayer = players[currentPlayerIndex]
    const currentScore = scores[currentPlayer.user_id]
    const outcome = evaluateVisit(currentScore, isNaN(scoreValue) ? -1 : scoreValue, config)

    if (outcome.kind === 'invalid') {
      setError(outcome.reason)
      return
    }

    // Bust — double-out aware (leaving 1, or an un-checkoutable finish)
    if (outcome.kind === 'bust') {
      setError('BUST! Score resets.')
      setInputValue('')

      // Log bust event (kept in local history so undo and turn order stay in sync)
      const { data: bustEvent, error: bustError } = await supabase
        .from('match_events')
        .insert({
          match_id: matchId,
          user_id: currentPlayer.user_id,
          event_type: 'visit',
          visit_number: visitHistory.filter(e => e.user_id === currentPlayer.user_id).length + 1,
          score_value: scoreValue,
          remaining_score: currentScore,
          leg_number: currentLeg,
          metadata: { bust: true }
        })
        .select()
        .single()

      if (bustError) console.error('Error logging bust:', bustError)
      else setVisitHistory([...visitHistory, bustEvent])

      // Move to next player
      setCurrentPlayerIndex((currentPlayerIndex + 1) % players.length)
      setTimeout(() => setError(''), 2000)
      return
    }

    // Check for leg win
    if (outcome.kind === 'leg_win') {
      try {
        // Log winning visit
        await supabase
          .from('match_events')
          .insert({
            match_id: matchId,
            user_id: currentPlayer.user_id,
            event_type: 'visit',
            visit_number: visitHistory.filter(e => e.user_id === currentPlayer.user_id).length + 1,
            score_value: scoreValue,
            remaining_score: 0,
            leg_number: currentLeg,
            metadata: { checkout: true, leg_win: true }
          })

        // Update player's legs won
        const updatedLegsWon = currentPlayer.legs_won + 1
        await supabase
          .from('match_players')
          .update({ legs_won: updatedLegsWon })
          .eq('id', currentPlayer.id)

        // Check if player won the match
        const legsToWin = match.legs_to_win || 1
        if (updatedLegsWon >= legsToWin) {
          // Match complete!
          await supabase
            .from('matches')
            .update({ status: 'complete', completed_at: new Date().toISOString() })
            .eq('id', matchId)

          await clearStationByMatchId(matchId).catch(() => {})

          alert(`${currentPlayer.users.name} wins the match ${updatedLegsWon}-${players.find(p => p.id !== currentPlayer.id).legs_won}!`)
          navigate(returnTo || '/bar/match-setup')
          return
        }

        // Start next leg
        const nextLeg = currentLeg + 1
        await supabase
          .from('matches')
          .update({ current_leg: nextLeg })
          .eq('id', matchId)

        alert(`${currentPlayer.users.name} wins leg ${currentLeg}! Starting leg ${nextLeg}...`)

        // Reload for next leg
        loadMatch()
        return
      } catch (err) {
        console.error('Error completing leg:', err)
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
          remaining_score: outcome.remaining,
          leg_number: currentLeg
        })
        .select()
        .single()

      if (eventError) throw eventError

      // Update local state
      setScores({
        ...scores,
        [currentPlayer.user_id]: outcome.remaining
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
  const legsToWin = match.legs_to_win || 1
  const totalLegs = (legsToWin * 2) - 1
  const checkoutHint = config.doubleOut ? getCheckout(scores[currentPlayer.user_id]) : null

  return (
    <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Darts Scoring</h1>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#666' }}>
          {config.startingScore} {config.doubleOut ? 'DO' : 'SO'} • Best of {totalLegs} • Leg {currentLeg}
        </div>
      </div>

      {/* Player Scores with Leg Counts */}
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
            <div style={{ fontSize: '1rem', color: '#666', marginBottom: '0.5rem' }}>
              Legs: {player.legs_won || 0}
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
        {checkoutHint && (
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#2e7d32' }}>
            Checkout: {checkoutHint}
          </div>
        )}
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
          onClick={() => navigate(returnTo || '/bar/match-setup')}
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
          {returnTo ? '← Back to Tournament' : 'New Match'}
        </button>
      </div>
    </div>
  )
}

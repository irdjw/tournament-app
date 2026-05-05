import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const STARTING_SCORE = 501

export default function Scoreboard() {
  const [currentMatch, setCurrentMatch] = useState(null)
  const [players, setPlayers] = useState([])
  const [scores, setScores] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCurrentMatch()
    subscribeToUpdates()
  }, [])

  const loadCurrentMatch = async () => {
    try {
      // Get the most recent in_progress match
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (matchError) {
        if (matchError.code === 'PGRST116') {
          // No matches found
          setLoading(false)
          return
        }
        throw matchError
      }

      setCurrentMatch(matchData)

      // Load players
      const { data: playersData, error: playersError } = await supabase
        .from('match_players')
        .select('*, users(*)')
        .eq('match_id', matchData.id)

      if (playersError) throw playersError
      setPlayers(playersData)

      // Initialize scores
      const initialScores = {}
      playersData.forEach(p => {
        initialScores[p.user_id] = STARTING_SCORE
      })

      // Load events and calculate current scores
      const { data: eventsData } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', matchData.id)
        .order('created_at', { ascending: true })

      if (eventsData && eventsData.length > 0) {
        eventsData.forEach(event => {
          initialScores[event.user_id] = event.remaining_score
        })
      }

      setScores(initialScores)
      setLoading(false)
    } catch (err) {
      console.error('Error loading match:', err)
      setLoading(false)
    }
  }

  const subscribeToUpdates = () => {
    // Subscribe to match_events table changes
    const channel = supabase
      .channel('scoreboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_events'
        },
        (payload) => {
          console.log('Event update:', payload)

          if (payload.eventType === 'INSERT') {
            const event = payload.new
            setScores(prev => ({
              ...prev,
              [event.user_id]: event.remaining_score
            }))
          } else if (payload.eventType === 'DELETE') {
            // Reload on delete (undo)
            loadCurrentMatch()
          }
        }
      )
      .subscribe()

    // Subscribe to match status changes
    const matchChannel = supabase
      .channel('match-status-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches'
        },
        (payload) => {
          console.log('Match update:', payload)
          if (payload.new.status === 'complete') {
            // Match finished, reload to get next match
            setTimeout(() => loadCurrentMatch(), 2000)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(matchChannel)
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '2rem'
      }}>
        Loading...
      </div>
    )
  }

  if (!currentMatch || players.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '2rem',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <div>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
          <div>No active match</div>
          <div style={{ fontSize: '1.25rem', marginTop: '1rem', color: '#666' }}>
            Start a match from Bar Mode
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '2rem',
      backgroundColor: '#1a1a1a',
      color: 'white'
    }}>
      <h1 style={{
        fontSize: '3rem',
        textAlign: 'center',
        marginBottom: '3rem',
        color: '#4CAF50'
      }}>
        🎯 LIVE DARTS
      </h1>

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2rem',
        alignItems: 'center'
      }}>
        {players.map((player, idx) => {
          const score = scores[player.user_id] || STARTING_SCORE
          const isWinner = score === 0

          return (
            <div
              key={player.id}
              style={{
                padding: '3rem',
                backgroundColor: isWinner ? '#4CAF50' : '#2a2a2a',
                border: `4px solid ${isWinner ? '#4CAF50' : '#444'}`,
                borderRadius: '16px',
                textAlign: 'center',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 'bold',
                marginBottom: '2rem',
                color: isWinner ? 'white' : '#4CAF50'
              }}>
                {player.users.name}
              </div>

              <div style={{
                fontSize: '8rem',
                fontWeight: 'bold',
                lineHeight: 1,
                color: isWinner ? 'white' : '#fff'
              }}>
                {score}
              </div>

              {isWinner && (
                <div style={{
                  marginTop: '2rem',
                  fontSize: '2rem',
                  fontWeight: 'bold'
                }}>
                  WINNER! 🏆
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: '2rem',
        textAlign: 'center',
        fontSize: '1.25rem',
        color: '#888'
      }}>
        Match #{currentMatch.id.slice(0, 8)} • {new Date(currentMatch.created_at).toLocaleTimeString()}
      </div>
    </div>
  )
}

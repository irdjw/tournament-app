import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const STARTING_SCORE = 501

export default function Scoreboard() {
  const [currentMatch, setCurrentMatch] = useState(null)
  const [players, setPlayers] = useState([])
  const [scores, setScores] = useState({})
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCurrentMatch()
    loadUpcomingMatches()
    subscribeToUpdates()
  }, [])

  async function loadCurrentMatch() {
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

      // Load events for current leg only
      const currentLeg = matchData.current_leg || 1
      const { data: eventsData } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', matchData.id)
        .eq('leg_number', currentLeg)
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

  async function loadUpcomingMatches() {
    try {
      const { data: pendingMatches, error } = await supabase
        .from('matches')
        .select(`
          *,
          match_players!inner(
            users(name)
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(5)

      if (error) throw error
      setUpcomingMatches(pendingMatches || [])
    } catch (err) {
      console.error('Error loading upcoming matches:', err)
    }
  }

  function subscribeToUpdates() {
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
          if (payload.new.status === 'complete' || payload.new.current_leg !== payload.old.current_leg) {
            // Match finished or new leg started, reload
            setTimeout(() => {
              loadCurrentMatch()
              loadUpcomingMatches()
            }, 1000)
          }
        }
      )
      .subscribe()

    // Subscribe to match_players updates (for legs_won)
    const playersChannel = supabase
      .channel('players-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'match_players'
        },
        () => {
          loadCurrentMatch()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(matchChannel)
      supabase.removeChannel(playersChannel)
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '2rem',
        backgroundColor: '#1a1a1a',
        color: 'white'
      }}>
        Loading...
      </div>
    )
  }

  if (!currentMatch || players.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white',
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
          <div style={{ fontSize: '2rem' }}>No active match</div>
          <div style={{ fontSize: '1.25rem', marginTop: '1rem', color: '#666' }}>
            Start a match from Bar Mode
          </div>
        </div>

        {upcomingMatches.length > 0 && (
          <div style={{ maxWidth: '600px', width: '100%' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#4CAF50' }}>
              Up Next
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {upcomingMatches.map(match => (
                <div key={match.id} style={{
                  padding: '1rem',
                  backgroundColor: '#2a2a2a',
                  borderRadius: '8px',
                  border: '2px solid #444'
                }}>
                  {match.match_players.map(mp => mp.users.name).join(' vs ')}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const legsToWin = currentMatch.legs_to_win || 1
  const totalLegs = (legsToWin * 2) - 1
  const currentLeg = currentMatch.current_leg || 1

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '2rem',
      backgroundColor: '#1a1a1a',
      color: 'white'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem', color: '#4CAF50' }}>
          🎯 LIVE DARTS
        </h1>
        <div style={{ fontSize: '1.5rem', color: '#888' }}>
          Best of {totalLegs} • Leg {currentLeg}
        </div>
      </div>

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2rem',
        alignItems: 'center'
      }}>
        {players.map((player) => {
          const score = scores[player.user_id] || STARTING_SCORE
          const legsWon = player.legs_won || 0

          return (
            <div
              key={player.id}
              style={{
                padding: '3rem',
                backgroundColor: '#2a2a2a',
                border: '4px solid #444',
                borderRadius: '16px',
                textAlign: 'center',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: '#4CAF50'
              }}>
                {player.users.name}
              </div>

              <div style={{
                fontSize: '1.5rem',
                marginBottom: '2rem',
                color: '#888'
              }}>
                Legs: {legsWon}
              </div>

              <div style={{
                fontSize: '8rem',
                fontWeight: 'bold',
                lineHeight: 1,
                color: '#fff'
              }}>
                {score}
              </div>
            </div>
          )
        })}
      </div>

      {upcomingMatches.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#666' }}>
            Up Next
          </h3>
          <div style={{ display: 'flex', gap: '1rem', overflow: 'auto' }}>
            {upcomingMatches.slice(0, 3).map(match => (
              <div key={match.id} style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#2a2a2a',
                borderRadius: '8px',
                border: '2px solid #444',
                fontSize: '1rem',
                whiteSpace: 'nowrap'
              }}>
                {match.match_players.map(mp => mp.users.name).join(' vs ')}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        marginTop: '1rem',
        textAlign: 'center',
        fontSize: '1rem',
        color: '#555'
      }}>
        Match #{currentMatch.id.slice(0, 8)} • {new Date(currentMatch.created_at).toLocaleTimeString()}
      </div>
    </div>
  )
}

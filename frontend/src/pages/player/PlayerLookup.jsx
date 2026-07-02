import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function PlayerLookup() {
  const [playerName, setPlayerName] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Find player by name
      const { data: players, error: playerError } = await supabase
        .from('users')
        .select('*')
        .ilike('name', `%${playerName}%`)

      if (playerError) throw playerError

      if (!players || players.length === 0) {
        setError('Player not found')
        setLoading(false)
        return
      }

      const player = players[0]
      setSelectedPlayer(player)

      // Load all matches for this player
      const { data: matchPlayers, error: matchError } = await supabase
        .from('match_players')
        .select(`
          *,
          matches!inner(
            id,
            status,
            match_type,
            legs_to_win,
            created_at,
            completed_at
          )
        `)
        .eq('user_id', player.id)
        .eq('matches.status', 'complete')
        .order('matches.created_at', { ascending: false })

      if (matchError) throw matchError

      // For each match, get opponent info and calculate result
      const enrichedMatches = await Promise.all(
        matchPlayers.map(async (mp) => {
          const matchId = mp.match_id

          // Get all players in this match
          const { data: allPlayers } = await supabase
            .from('match_players')
            .select('*, users(*)')
            .eq('match_id', matchId)

          const opponent = allPlayers.find(p => p.user_id !== player.id)
          const playerData = allPlayers.find(p => p.user_id === player.id)

          const playerLegs = playerData?.legs_won || 0
          const opponentLegs = opponent?.legs_won || 0
          const won = playerLegs > opponentLegs

          // Calculate statistics
          const { data: playerEvents } = await supabase
            .from('match_events')
            .select('*')
            .eq('match_id', matchId)
            .eq('user_id', player.id)

          let totalScore = 0
          let visits = 0
          let highestScore = 0

          playerEvents?.forEach(event => {
            if (!event.metadata?.bust) {
              totalScore += event.score_value
              visits++
              if (event.score_value > highestScore) {
                highestScore = event.score_value
              }
            }
          })

          const average = visits > 0 ? (totalScore / visits).toFixed(2) : '0.00'

          return {
            ...mp.matches,
            opponent: opponent?.users,
            playerLegs,
            opponentLegs,
            won,
            average,
            highestScore,
            totalVisits: visits
          }
        })
      )

      setMatches(enrichedMatches)
      setLoading(false)
    } catch (err) {
      console.error('Error searching player:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  // Calculate overall stats
  const wins = matches.filter(m => m.won).length
  const losses = matches.length - wins
  const winRate = matches.length > 0 ? ((wins / matches.length) * 100).toFixed(0) : 0
  const overallAverage = matches.length > 0
    ? (matches.reduce((sum, m) => sum + parseFloat(m.average), 0) / matches.length).toFixed(2)
    : '0.00'
  const bestAverage = matches.length > 0
    ? Math.max(...matches.map(m => parseFloat(m.average))).toFixed(2)
    : '0.00'

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem', color: '#333' }}>Player Stats</h1>

      {!selectedPlayer ? (
        <div>
          <form onSubmit={handleSearch}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Enter Player Name:
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1.1rem',
                  border: '2px solid #ccc',
                  borderRadius: '4px'
                }}
                placeholder="Search for a player..."
              />
            </div>

            {error && (
              <div style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px' }}>
                {error}
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
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '2rem', color: '#333', margin: 0 }}>{selectedPlayer.name}</h2>
            <button
              onClick={() => {
                setSelectedPlayer(null)
                setMatches([])
                setPlayerName('')
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Search Another
            </button>
          </div>

          {/* Stats Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4CAF50' }}>{matches.length}</div>
              <div style={{ color: '#666' }}>Matches</div>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4CAF50' }}>{wins}</div>
              <div style={{ color: '#666' }}>Wins</div>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f44336' }}>{losses}</div>
              <div style={{ color: '#666' }}>Losses</div>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2196F3' }}>{winRate}%</div>
              <div style={{ color: '#666' }}>Win Rate</div>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#FF9800' }}>{overallAverage}</div>
              <div style={{ color: '#666' }}>Avg Score</div>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#9C27B0' }}>{bestAverage}</div>
              <div style={{ color: '#666' }}>Best Avg</div>
            </div>
          </div>

          {/* Match History */}
          <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>Match History</h3>

          {matches.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'white', borderRadius: '8px' }}>
              No matches found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {matches.map((match) => (
                <div
                  key={match.id}
                  style={{
                    padding: '1.5rem',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    border: `3px solid ${match.won ? '#4CAF50' : '#f44336'}`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: match.won ? '#4CAF50' : '#f44336' }}>
                      {match.won ? 'WIN' : 'LOSS'}
                    </div>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>
                      {new Date(match.created_at).toLocaleDateString()} {new Date(match.created_at).toLocaleTimeString()}
                    </div>
                  </div>

                  <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                    <strong>{selectedPlayer.name}</strong> vs <strong>{match.opponent?.name || 'Unknown'}</strong>
                  </div>

                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#333' }}>
                    {match.playerLegs} - {match.opponentLegs}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.9rem' }}>
                    <div>
                      <div style={{ color: '#666' }}>3-Dart Avg</div>
                      <div style={{ fontWeight: 'bold' }}>{match.average}</div>
                    </div>
                    <div>
                      <div style={{ color: '#666' }}>Highest Score</div>
                      <div style={{ fontWeight: 'bold' }}>{match.highestScore}</div>
                    </div>
                    <div>
                      <div style={{ color: '#666' }}>Total Visits</div>
                      <div style={{ fontWeight: 'bold' }}>{match.totalVisits}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Standings() {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStandings()
  }, [])

  const loadStandings = async () => {
    try {
      // Get all completed matches and calculate standings
      const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select(`
          id,
          status,
          match_players!inner(
            user_id,
            legs_won,
            users(name)
          )
        `)
        .eq('status', 'complete')

      if (matchError) throw matchError

      // Build standings from matches
      const playerStats = {}

      matches?.forEach(match => {
        const players = match.match_players

        if (players.length === 2) {
          const [p1, p2] = players

          // Initialize if needed
          if (!playerStats[p1.user_id]) {
            playerStats[p1.user_id] = {
              userId: p1.user_id,
              name: p1.users.name,
              played: 0,
              wins: 0,
              losses: 0,
              legsFor: 0,
              legsAgainst: 0
            }
          }
          if (!playerStats[p2.user_id]) {
            playerStats[p2.user_id] = {
              userId: p2.user_id,
              name: p2.users.name,
              played: 0,
              wins: 0,
              losses: 0,
              legsFor: 0,
              legsAgainst: 0
            }
          }

          // Update stats
          playerStats[p1.user_id].played++
          playerStats[p2.user_id].played++

          playerStats[p1.user_id].legsFor += p1.legs_won || 0
          playerStats[p1.user_id].legsAgainst += p2.legs_won || 0

          playerStats[p2.user_id].legsFor += p2.legs_won || 0
          playerStats[p2.user_id].legsAgainst += p1.legs_won || 0

          // Determine winner
          if ((p1.legs_won || 0) > (p2.legs_won || 0)) {
            playerStats[p1.user_id].wins++
            playerStats[p2.user_id].losses++
          } else {
            playerStats[p2.user_id].wins++
            playerStats[p1.user_id].losses++
          }
        }
      })

      // Convert to array and sort by wins, then leg difference
      const standingsArray = Object.values(playerStats).map(player => ({
        ...player,
        points: player.wins * 2, // 2 points per win
        legDiff: player.legsFor - player.legsAgainst,
        winRate: player.played > 0 ? ((player.wins / player.played) * 100).toFixed(0) : 0
      }))

      standingsArray.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.legDiff !== a.legDiff) return b.legDiff - a.legDiff
        return b.legsFor - a.legsFor
      })

      setStandings(standingsArray)
      setLoading(false)
    } catch (err) {
      console.error('Error loading standings:', err)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading standings...
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', color: '#333', textAlign: 'center' }}>
        🏆 League Standings
      </h1>

      {standings.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
          <div style={{ fontSize: '1.5rem', color: '#666' }}>No matches completed yet</div>
          <div style={{ marginTop: '1rem', color: '#999' }}>Play some matches to build the standings!</div>
        </div>
      ) : (
        <div style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          {/* Desktop Table */}
          <div style={{ display: 'none', '@media (min-width: 768px)': { display: 'block' } }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#4CAF50', color: 'white' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold' }}>Pos</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 'bold' }}>Player</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>P</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>W</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>L</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>LF</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>LA</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>Diff</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>Win%</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((player, index) => (
                  <tr
                    key={player.userId}
                    style={{
                      backgroundColor: index % 2 === 0 ? 'white' : '#f9f9f9',
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    <td style={{ padding: '1rem', fontWeight: 'bold', color: index < 3 ? '#4CAF50' : '#333' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{player.name}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>{player.played}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: '#4CAF50', fontWeight: 'bold' }}>{player.wins}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: '#f44336' }}>{player.losses}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>{player.legsFor}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>{player.legsAgainst}</td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', color: player.legDiff > 0 ? '#4CAF50' : player.legDiff < 0 ? '#f44336' : '#666' }}>
                      {player.legDiff > 0 ? '+' : ''}{player.legDiff}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>{player.winRate}%</td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', color: '#4CAF50' }}>
                      {player.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div style={{ display: 'block' }}>
            {standings.map((player, index) => (
              <div
                key={player.userId}
                style={{
                  padding: '1.5rem',
                  borderBottom: '1px solid #eee',
                  backgroundColor: index % 2 === 0 ? 'white' : '#f9f9f9'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: index < 3 ? '#4CAF50' : '#666' }}>
                      #{index + 1}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{player.name}</div>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4CAF50' }}>
                    {player.points} pts
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.9rem' }}>
                  <div>
                    <div style={{ color: '#666' }}>Record</div>
                    <div style={{ fontWeight: 'bold' }}>
                      <span style={{ color: '#4CAF50' }}>{player.wins}</span>
                      {' - '}
                      <span style={{ color: '#f44336' }}>{player.losses}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#666' }}>Legs</div>
                    <div style={{ fontWeight: 'bold' }}>{player.legsFor}-{player.legsAgainst}</div>
                  </div>
                  <div>
                    <div style={{ color: '#666' }}>Win Rate</div>
                    <div style={{ fontWeight: 'bold' }}>{player.winRate}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginBottom: '1rem', color: '#333' }}>Scoring System</h3>
        <ul style={{ color: '#666', lineHeight: 1.8 }}>
          <li>Win: 2 points</li>
          <li>Loss: 0 points</li>
          <li>Ranked by: Points → Leg Difference → Legs For</li>
        </ul>
      </div>
    </div>
  )
}

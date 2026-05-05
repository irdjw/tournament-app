import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>
        <h1 style={{
          fontSize: '3rem',
          textAlign: 'center',
          marginBottom: '1rem',
          color: '#333'
        }}>
          🎯 Pub Sports
        </h1>
        <p style={{
          textAlign: 'center',
          fontSize: '1.25rem',
          color: '#666',
          marginBottom: '3rem'
        }}>
          Darts scoring & league management
        </p>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <Link
            to="/bar/match-setup"
            style={{
              padding: '2rem',
              backgroundColor: '#4CAF50',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              transition: 'transform 0.2s',
              display: 'block'
            }}
          >
            📱 Bar Mode
            <div style={{ fontSize: '1rem', marginTop: '0.5rem', fontWeight: 'normal' }}>
              Create and score matches
            </div>
          </Link>

          <Link
            to="/display/scoreboard"
            style={{
              padding: '2rem',
              backgroundColor: '#2196F3',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              transition: 'transform 0.2s',
              display: 'block'
            }}
          >
            📺 Display Mode
            <div style={{ fontSize: '1rem', marginTop: '0.5rem', fontWeight: 'normal' }}>
              Live scoreboard for TV
            </div>
          </Link>

          <Link
            to="/player"
            style={{
              padding: '2rem',
              backgroundColor: '#FF9800',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              transition: 'transform 0.2s',
              display: 'block'
            }}
          >
            👤 Player Stats
            <div style={{ fontSize: '1rem', marginTop: '0.5rem', fontWeight: 'normal' }}>
              View match history
            </div>
          </Link>

          <Link
            to="/standings"
            style={{
              padding: '2rem',
              backgroundColor: '#9C27B0',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              transition: 'transform 0.2s',
              display: 'block'
            }}
          >
            🏆 Standings
            <div style={{ fontSize: '1rem', marginTop: '0.5rem', fontWeight: 'normal' }}>
              League table
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

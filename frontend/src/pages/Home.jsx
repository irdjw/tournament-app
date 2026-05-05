import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'

const FOLLOWED_KEY = 'followedTournaments'

function getFollowed() {
  try {
    return JSON.parse(localStorage.getItem(FOLLOWED_KEY) ?? '[]')
  } catch {
    return []
  }
}

export default function Home() {
  const [followedTournaments, setFollowedTournaments] = useState([])
  const [recentMatches, setRecentMatches] = useState([])
  const [venueName, setVenueName] = useState('')
  const venueUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    // Load followed tournaments
    const ids = getFollowed()
    if (ids.length > 0) {
      supabase
        .from('tournaments')
        .select('id, name, status')
        .in('id', ids)
        .then(({ data }) => { if (data) setFollowedTournaments(data) })
    }

    // Load venue name
    supabase.from('venues').select('name').limit(1).single()
      .then(({ data }) => { if (data) setVenueName(data.name) })

    // Load recent completed matches
    supabase
      .from('matches')
      .select('id, status, created_at, match_players(team_id, legs_won, users(name))')
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setRecentMatches(data) })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-8 px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🎯</div>
          <h1 className="text-3xl font-bold text-gray-900 m-0">
            {venueName || 'Pub Sports'}
          </h1>
          <p className="text-gray-500 mt-1">Darts &amp; leagues</p>
        </div>

        {/* Main player actions */}
        <div className="grid gap-3 mb-8">
          <Link
            to="/standings"
            className="flex items-center gap-4 p-4 bg-purple-600 text-white rounded-xl no-underline hover:bg-purple-500 transition-colors shadow"
          >
            <span className="text-3xl">🏆</span>
            <div>
              <div className="font-bold text-lg">View Standings</div>
              <div className="text-purple-200 text-sm">League tables &amp; rankings</div>
            </div>
          </Link>

          <Link
            to="/tournament"
            className="flex items-center gap-4 p-4 bg-indigo-600 text-white rounded-xl no-underline hover:bg-indigo-500 transition-colors shadow"
          >
            <span className="text-3xl">📊</span>
            <div>
              <div className="font-bold text-lg">View Tournaments</div>
              <div className="text-indigo-200 text-sm">Brackets, results &amp; progress</div>
            </div>
          </Link>

          <Link
            to="/player"
            className="flex items-center gap-4 p-4 bg-orange-500 text-white rounded-xl no-underline hover:bg-orange-400 transition-colors shadow"
          >
            <span className="text-3xl">👤</span>
            <div>
              <div className="font-bold text-lg">My Results</div>
              <div className="text-orange-100 text-sm">Search your match history</div>
            </div>
          </Link>
        </div>

        {/* Followed tournaments */}
        {followedTournaments.length > 0 && (
          <section className="mb-6">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Following</div>
            {followedTournaments.map(t => (
              <Link
                key={t.id}
                to={`/tournament/${t.id}`}
                className="flex items-center justify-between p-3 bg-gray-800 text-white rounded-xl mb-2 no-underline hover:bg-gray-700 transition-colors"
              >
                <span className="font-semibold">🏆 {t.name}</span>
                <span className={`text-xs font-bold uppercase ${t.status === 'active' ? 'text-amber-400' : t.status === 'complete' ? 'text-green-400' : 'text-gray-400'}`}>
                  {t.status === 'active' ? 'Live' : t.status === 'complete' ? 'Complete' : 'Setup'}
                </span>
              </Link>
            ))}
          </section>
        )}

        {/* Recent results */}
        {recentMatches.length > 0 && (
          <section className="mb-6">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Recent Results</div>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 shadow-sm">
              {recentMatches.map(m => {
                const playerA = m.match_players?.find(p => p.team_id === 'team_a')
                const playerB = m.match_players?.find(p => p.team_id === 'team_b')
                if (!playerA || !playerB) return null
                const winner = playerA.legs_won > playerB.legs_won ? playerA : playerB
                return (
                  <div key={m.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      <span className={playerA.legs_won > playerB.legs_won ? 'font-bold text-gray-900' : 'text-gray-500'}>{playerA.users?.name}</span>
                      <span className="mx-2 text-gray-400">{playerA.legs_won}–{playerB.legs_won}</span>
                      <span className={playerB.legs_won > playerA.legs_won ? 'font-bold text-gray-900' : 'text-gray-500'}>{playerB.users?.name}</span>
                    </span>
                    <span className="text-xs text-gray-400">W: {winner.users?.name}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* QR Code */}
        <section className="flex flex-col items-center text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Share this venue</div>
          <div className="bg-white p-4 rounded-xl shadow border border-gray-200 inline-block">
            <QRCodeSVG value={venueUrl} size={140} />
          </div>
          <p className="text-xs text-gray-400 mt-2">{venueUrl}</p>
        </section>

        {/* Mode switcher footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex justify-center gap-4 text-sm">
          <Link to="/bar" className="text-gray-500 hover:text-gray-700 transition-colors">📱 Bar Staff</Link>
          <a href="/display" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700 transition-colors">📺 Display ↗</a>
        </div>
      </div>
    </div>
  )
}

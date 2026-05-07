import { useEffect, useState } from 'react'
import { NavLink, Outlet, useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { VenueContext } from '../../contexts/VenueContext'
import type { VenueCtx } from '../../contexts/VenueContext'

const APP_NAME = 'DartScore'

function NotFound({ slug }: { slug: string }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl mb-4">🎯</p>
      <h1 className="text-2xl font-bold text-white mb-2">Venue not found</h1>
      <p className="text-gray-400 mb-6">
        No venue exists at <code className="text-purple-400">/v/{slug}</code>.
      </p>
      <Link to="/" className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors">
        Go home
      </Link>
    </div>
  )
}

export default function VenueLayout() {
  const { slug } = useParams<{ slug: string }>()
  const [venue, setVenue] = useState<VenueCtx | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [liveCount, setLiveCount] = useState(0)

  useEffect(() => {
    supabase
      .from('venues')
      .select('id, name, slug')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true)
        } else {
          setVenue(data as VenueCtx)
        }
        setLoading(false)
      })
  }, [slug])

  useEffect(() => {
    if (!venue?.id) return
    supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venue.id)
      .eq('status', 'in_progress')
      .then(({ count }) => setLiveCount(count ?? 0))
  }, [venue?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  if (notFound || !venue) return <NotFound slug={slug ?? ''} />

  const navItems = [
    { label: 'Home', to: `/v/${slug}` },
    { label: 'Standings', to: `/v/${slug}/standings` },
    { label: 'Fixtures', to: `/v/${slug}/fixtures` },
    { label: 'Results', to: `/v/${slug}/results` },
  ]

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors ${
      isActive ? 'text-white' : 'text-gray-400 hover:text-white'
    }`

  return (
    <VenueContext.Provider value={venue}>
      <div className="min-h-screen bg-gray-950">
        {/* Top nav */}
        <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <Link to={`/v/${slug}`} className="text-white font-bold text-base truncate">
              {venue.name}
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-6">
              {navItems.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to === `/v/${slug}`} className={navClass}>
                  {item.label}
                </NavLink>
              ))}
              <NavLink
                to={`/v/${slug}/live`}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    isActive ? 'text-green-300' : 'text-green-400 hover:text-green-300'
                  }`
                }
              >
                {liveCount > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                )}
                Live
                {liveCount > 0 && (
                  <span className="text-xs bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded-full">
                    {liveCount}
                  </span>
                )}
              </NavLink>
            </nav>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(m => !m)}
              className="sm:hidden p-2 text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                }
              </svg>
            </button>
          </div>

          {/* Mobile dropdown */}
          {menuOpen && (
            <nav className="sm:hidden border-t border-gray-800 bg-gray-950 px-4 py-3 space-y-1">
              {[...navItems, { label: liveCount > 0 ? `Live (${liveCount})` : 'Live', to: `/v/${slug}/live` }].map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === `/v/${slug}`}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block py-2 text-sm font-medium transition-colors ${
                      isActive ? 'text-white' : 'text-gray-400'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </header>

        {/* Page content */}
        <main className="max-w-5xl mx-auto px-4 py-6">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-800 mt-12 py-6 text-center text-xs text-gray-600">
          Powered by <span className="text-gray-500">{APP_NAME}</span>
        </footer>
      </div>
    </VenueContext.Provider>
  )
}

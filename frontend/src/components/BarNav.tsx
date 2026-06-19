import { useNavigate, useLocation } from 'react-router-dom'

export default function BarNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/bar'

  return (
    <nav className="sticky top-0 z-40 bg-gray-900 text-white border-b border-gray-700 px-3 sm:px-4 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Left: label */}
        <span className="text-sm font-bold tracking-wide text-amber-400 uppercase mr-auto shrink-0">
          📱 Bar Mode
        </span>

        {/* Back / Home buttons */}
        {!isHome && (
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors shrink-0"
          >
            ← Back
          </button>
        )}
        <button
          onClick={() => navigate('/bar')}
          className="text-sm text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors shrink-0"
        >
          🏠 Home
        </button>

        {/* Mode switcher */}
        <div className="flex items-center gap-1 border border-gray-600 rounded-lg overflow-hidden text-xs font-semibold shrink-0">
          <span className="px-2.5 py-1 bg-amber-600 text-white">Bar</span>
          <a
            href="/display"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Display ↗
          </a>
          <a
            href="/standings"
            className="px-2.5 py-1 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Standings
          </a>
        </div>
      </div>
    </nav>
  )
}

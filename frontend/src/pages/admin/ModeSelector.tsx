import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, Home } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export default function ModeSelector() {
  const { isPlatformAdmin, isLoading, setMode, currentMode } = useAuth()
  const navigate = useNavigate()

  // Already have a mode — skip the selector
  useEffect(() => {
    if (isLoading) return
    if (!isPlatformAdmin) { navigate('/admin', { replace: true }); return }
    if (currentMode === 'god') navigate('/admin/god', { replace: true })
    else if (currentMode === 'personal') navigate('/admin', { replace: true })
  }, [isLoading, isPlatformAdmin, currentMode, navigate])

  if (isLoading || currentMode !== null) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading…</div>
      </div>
    )
  }

  function choose(mode: 'god' | 'personal') {
    setMode(mode)
    navigate(mode === 'god' ? '/admin/god' : '/admin', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">Choose your view</h1>
        <p className="text-gray-400 mt-2 text-sm">You have access to multiple levels. Which hat are you wearing?</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 w-full max-w-2xl">
        {/* God Mode */}
        <button
          onClick={() => choose('god')}
          className="flex-1 group relative rounded-2xl border border-red-500/60 bg-red-950/60 p-8 text-left
                     hover:border-red-400 hover:bg-red-950/80 transition-all duration-200
                     focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          <div className="w-14 h-14 rounded-xl bg-red-900/80 border border-red-700/50 flex items-center justify-center mb-5 group-hover:bg-red-800/80 transition-colors">
            <ShieldAlert className="w-7 h-7 text-red-300" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">God Mode</h2>
          <p className="text-red-200/70 text-sm leading-relaxed">
            Full platform access — all venues, all data, real-time activity across the entire system.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-red-300 uppercase tracking-widest">
            Enter God Mode
            <span className="opacity-60 group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </button>

        {/* Personal Venue */}
        <button
          onClick={() => choose('personal')}
          className="flex-1 group relative rounded-2xl border border-blue-500/60 bg-blue-950/60 p-8 text-left
                     hover:border-blue-400 hover:bg-blue-950/80 transition-all duration-200
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          <div className="w-14 h-14 rounded-xl bg-blue-900/80 border border-blue-700/50 flex items-center justify-center mb-5 group-hover:bg-blue-800/80 transition-colors">
            <Home className="w-7 h-7 text-blue-300" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">David's League</h2>
          <p className="text-blue-200/70 text-sm leading-relaxed">
            Your personal venue — darts, pool, Friday nights. Manage players, fixtures and tournaments.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-blue-300 uppercase tracking-widest">
            Enter Venue Admin
            <span className="opacity-60 group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </button>
      </div>

      <p className="mt-8 text-xs text-gray-600">Your choice is remembered until you switch modes.</p>
    </div>
  )
}

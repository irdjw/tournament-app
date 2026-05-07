import { Outlet, useLocation, Link } from 'react-router-dom'

const STEPS = [
  { path: '/onboarding', label: 'Venue' },
  { path: '/onboarding/sport', label: 'Sport' },
  { path: '/onboarding/stations', label: 'Stations' },
  { path: '/onboarding/players', label: 'Players' },
]

export default function OnboardingLayout() {
  const location = useLocation()
  const isDone = location.pathname === '/onboarding/done'
  const currentIdx = STEPS.findIndex(s => s.path === location.pathname)

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="border-b border-gray-800">
        <div className="max-w-lg mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-white text-base tracking-tight">DartScore</Link>
          <Link to="/login" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Already have an account?
          </Link>
        </div>
      </div>

      {!isDone && (
        <div className="border-b border-gray-800/50 bg-gray-900/30">
          <div className="max-w-lg mx-auto px-5 py-5">
            <div className="flex items-center">
              {STEPS.map((step, i) => (
                <div key={step.path} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                      i < currentIdx
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : i === currentIdx
                        ? 'border-purple-500 text-purple-400 bg-purple-900/30'
                        : 'border-gray-700 text-gray-600 bg-transparent'
                    }`}>
                      {i < currentIdx ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs mt-1.5 transition-colors ${
                      i === currentIdx ? 'text-white' : i < currentIdx ? 'text-purple-400' : 'text-gray-600'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${
                      i < currentIdx ? 'bg-purple-600' : 'bg-gray-800'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex items-start justify-center py-10 px-5">
        <div className="w-full max-w-lg">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

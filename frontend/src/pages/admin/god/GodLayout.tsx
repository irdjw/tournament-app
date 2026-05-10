import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ShieldAlert, Activity, LayoutGrid, Settings } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { supabase } from '../../../lib/supabase'

const NAV = [
  { label: 'Platform', to: '/admin/god', end: true, Icon: LayoutGrid },
  { label: 'Activity',  to: '/admin/god/activity', Icon: Activity },
  { label: 'Settings',  to: '/admin/god/settings', Icon: Settings },
]

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-red-900/50 text-red-300'
      : 'text-gray-400 hover:text-white hover:bg-gray-800'
  }`

export default function GodLayout() {
  const { user, isPlatformAdmin, isLoading, switchMode } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    if (!isPlatformAdmin) navigate('/admin', { replace: true })
  }, [isLoading, isPlatformAdmin, navigate])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-14 lg:w-56 bg-gray-900 border-r border-red-900/40 z-30">
        {/* Badge */}
        <div className="flex items-center gap-3 px-3 h-14 border-b border-red-900/40 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-red-800/80 border border-red-600/50 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4 text-red-300" />
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest leading-none">God Mode</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Platform Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ label, to, end, Icon }) => (
            <NavLink key={to} to={to} end={end} className={navClass}>
              <Icon className="w-5 h-5 shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-red-900/40 shrink-0 space-y-0.5">
          <button
            onClick={switchMode}
            className="flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm text-amber-400 hover:text-amber-300 hover:bg-gray-800 transition-colors"
            title="Switch Mode"
          >
            <span className="text-base shrink-0">⚡</span>
            <span className="hidden lg:block">Switch Mode</span>
          </button>
          <div className="hidden lg:block px-2.5 py-1">
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span className="hidden lg:block">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 md:pl-14 lg:pl-56 min-h-screen overflow-hidden">
        {/* God Mode banner — full width */}
        <div className="bg-red-950/80 border-b border-red-800/60 px-4 md:px-6 h-10 flex items-center gap-2 shrink-0">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs font-bold text-red-300 uppercase tracking-widest">God Mode — Full Platform Access</span>
        </div>

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-gray-900 border-b border-red-900/40 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold text-red-300">God Mode</span>
          </div>
          <button onClick={handleSignOut} className="p-1.5 text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

type IconName = 'home' | 'users' | 'calendar' | 'trophy' | 'clock' | 'table' | 'cog' | 'signout'

const ICONS: Record<IconName, string | string[]> = {
  home: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z',
  trophy: 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  table: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h.008v.008h-.008V8.25zm0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m0 0H3.375',
  cog: [
    'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z',
    'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  ],
  signout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75',
}

function Icon({ name, className = 'w-5 h-5' }: { name: IconName; className?: string }) {
  const paths = ICONS[name]
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      {Array.isArray(paths)
        ? paths.map((p, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" d={p} />)
        : <path strokeLinecap="round" strokeLinejoin="round" d={paths} />}
    </svg>
  )
}

const NAV: { label: string; to: string; end?: boolean; icon: IconName }[] = [
  { label: 'Dashboard',   to: '/admin',              end: true, icon: 'home' },
  { label: 'Players',     to: '/admin/players',       icon: 'users' },
  { label: 'Leagues',     to: '/admin/leagues',       icon: 'calendar' },
  { label: 'Tournaments', to: '/admin/tournaments',   icon: 'trophy' },
  { label: 'History',     to: '/admin/history',       icon: 'clock' },
  { label: 'Stations',    to: '/admin/stations',      icon: 'table' },
  { label: 'Settings',    to: '/admin/settings',      icon: 'cog' },
]

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-purple-900/50 text-purple-300'
      : 'text-gray-400 hover:text-white hover:bg-gray-800'
  }`

export default function AdminLayout() {
  const { user, venue, isPlatformAdmin, currentMode, impersonatedVenueId, isLoading, switchMode } = useAuth()
  const navigate = useNavigate()

  // Redirect platform admins with no mode to the selector
  useEffect(() => {
    if (isLoading) return
    if (isPlatformAdmin && currentMode === null) {
      navigate('/admin/mode', { replace: true })
    }
  }, [isLoading, isPlatformAdmin, currentMode, navigate])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (isLoading || (isPlatformAdmin && currentMode === null)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Impersonation banner */}
      {impersonatedVenueId && (
        <div className="fixed top-0 inset-x-0 z-50 bg-red-900 border-b border-red-700 px-4 h-9 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-red-300" />
            <span className="text-xs font-semibold text-red-200 uppercase tracking-wider">
              Impersonating venue
            </span>
          </div>
          <button
            onClick={() => { /* clear impersonation */ window.location.href = '/admin/god' }}
            className="text-xs text-red-300 hover:text-white underline"
          >
            Stop impersonating
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`hidden md:flex flex-col fixed inset-y-0 left-0 bg-gray-900 border-r w-14 lg:w-56 z-30 ${
        impersonatedVenueId ? 'top-9' : ''
      } border-gray-800`}>
        {/* Venue badge */}
        <div className="flex items-center gap-3 px-3 h-14 border-b border-gray-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">
              {(venue?.name ?? 'V').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden lg:block min-w-0">
            <span className="text-sm font-semibold text-white truncate block">{venue?.name ?? 'Venue'}</span>
            {isPlatformAdmin && (
              <span className="text-[10px] text-purple-400 uppercase tracking-widest">Personal</span>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              <Icon name={item.icon} className="w-5 h-5 shrink-0" />
              <span className="hidden lg:block">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-gray-800 shrink-0 space-y-0.5">
          {isPlatformAdmin && (
            <button
              onClick={switchMode}
              className="flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
              title="Switch Mode"
            >
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span className="hidden lg:block">Switch Mode</span>
            </button>
          )}
          <Link
            to="/bar"
            className="flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm text-amber-400 hover:text-amber-300 hover:bg-gray-800 transition-colors"
            title="Bar Mode"
          >
            <span className="text-base shrink-0">📱</span>
            <span className="hidden lg:block">Bar Mode</span>
          </Link>
          <div className="hidden lg:block px-2.5 py-1.5">
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <Icon name="signout" className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex flex-col flex-1 md:pl-14 lg:pl-56 min-h-screen overflow-hidden ${
        impersonatedVenueId ? 'pt-9' : ''
      }`}>
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-gray-900 border-b border-gray-800 shrink-0">
          <span className="text-sm font-semibold text-white">{venue?.name ?? 'Admin'}</span>
          <div className="flex items-center gap-3">
            {isPlatformAdmin && (
              <button onClick={switchMode} className="p-1.5 text-red-400 hover:text-red-300">
                <ShieldAlert className="w-5 h-5" />
              </button>
            )}
            <span className="text-xs text-gray-500 truncate max-w-[120px]">{user?.email}</span>
            <button onClick={handleSignOut} className="p-1.5 text-gray-400 hover:text-white">
              <Icon name="signout" className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-30">
        <div className="flex">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                  isActive ? 'text-purple-400' : 'text-gray-500'
                }`
              }
            >
              <Icon name={item.icon} className="w-5 h-5" />
              <span className="text-[9px] leading-tight">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

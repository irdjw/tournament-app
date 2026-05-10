import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getVenueAdmin, getPlatformAdmin } from '../lib/auth'
import type { Venue, VenueAdmin } from '../lib/auth'

export type AdminMode = 'god' | 'personal'

const MODE_KEY = 'tournament_admin_mode'
const IMPERSONATE_KEY = 'tournament_impersonate_venue'

function readMode(): AdminMode | null {
  try {
    const v = localStorage.getItem(MODE_KEY)
    return v === 'god' || v === 'personal' ? v : null
  } catch { return null }
}

function readImpersonatedVenueId(): string | null {
  try { return localStorage.getItem(IMPERSONATE_KEY) } catch { return null }
}

interface AuthState {
  user: User | null
  venueAdmin: VenueAdmin | null
  venue: Venue | null
  isPlatformAdmin: boolean
  currentMode: AdminMode | null
  impersonatedVenueId: string | null
  isLoading: boolean
  setMode: (mode: AdminMode) => void
  switchMode: () => void
  setImpersonatedVenue: (venueId: string | null) => void
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [venueAdmin, setVenueAdmin] = useState<VenueAdmin | null>(null)
  const [venue, setVenue] = useState<Venue | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [currentMode, setCurrentMode] = useState<AdminMode | null>(readMode)
  const [impersonatedVenueId, setImpersonatedVenueIdState] = useState<string | null>(readImpersonatedVenueId)
  const [isLoading, setIsLoading] = useState(true)

  async function loadUserData(currentUser: User | null) {
    if (!currentUser) {
      setVenueAdmin(null)
      setVenue(null)
      setIsPlatformAdmin(false)
      return
    }
    const [va, isAdmin] = await Promise.all([
      getVenueAdmin(currentUser.id),
      getPlatformAdmin(currentUser.id),
    ])
    setVenueAdmin(va)
    setVenue(va?.venue ?? null)
    setIsPlatformAdmin(isAdmin)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      await loadUserData(currentUser)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      await loadUserData(currentUser)
    })

    return () => subscription.unsubscribe()
  }, [])

  const setMode = useCallback((mode: AdminMode) => {
    try { localStorage.setItem(MODE_KEY, mode) } catch { /* */ }
    setCurrentMode(mode)
  }, [])

  const switchMode = useCallback(() => {
    try {
      localStorage.removeItem(MODE_KEY)
      localStorage.removeItem(IMPERSONATE_KEY)
    } catch { /* */ }
    setCurrentMode(null)
    setImpersonatedVenueIdState(null)
    window.location.href = '/admin/mode'
  }, [])

  const setImpersonatedVenue = useCallback((venueId: string | null) => {
    try {
      if (venueId) localStorage.setItem(IMPERSONATE_KEY, venueId)
      else localStorage.removeItem(IMPERSONATE_KEY)
    } catch { /* */ }
    setImpersonatedVenueIdState(venueId)
  }, [])

  return {
    user,
    venueAdmin,
    venue,
    isPlatformAdmin,
    currentMode,
    impersonatedVenueId,
    isLoading,
    setMode,
    switchMode,
    setImpersonatedVenue,
  }
}

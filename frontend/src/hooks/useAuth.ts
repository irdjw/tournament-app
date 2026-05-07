import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getVenueAdmin } from '../lib/auth'
import type { Venue, VenueAdmin } from '../lib/auth'

interface AuthState {
  user: User | null
  venueAdmin: VenueAdmin | null
  venue: Venue | null
  isLoading: boolean
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [venueAdmin, setVenueAdmin] = useState<VenueAdmin | null>(null)
  const [venue, setVenue] = useState<Venue | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const va = await getVenueAdmin(currentUser.id)
        setVenueAdmin(va)
        setVenue(va?.venue ?? null)
      }
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const va = await getVenueAdmin(currentUser.id)
        setVenueAdmin(va)
        setVenue(va?.venue ?? null)
      } else {
        setVenueAdmin(null)
        setVenue(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, venueAdmin, venue, isLoading }
}

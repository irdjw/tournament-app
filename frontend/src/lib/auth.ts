import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Venue {
  id: string
  name: string
  slug: string
}

export interface VenueAdmin {
  id: string
  user_id: string
  venue_id: string
  role: 'admin' | 'staff'
  venue: Venue
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getVenueAdmin(userId: string): Promise<VenueAdmin | null> {
  const { data, error } = await supabase
    .from('venue_admins')
    .select('*, venue:venues(*)')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data as VenueAdmin
}

// Returns the authenticated user, or null if there is no session.
export async function requireAuth(): Promise<User | null> {
  const session = await getSession()
  return session?.user ?? null
}

// Returns the venue admin record for the authenticated user, or null.
export async function requireVenueAdmin(): Promise<VenueAdmin | null> {
  const user = await requireAuth()
  if (!user) return null
  return getVenueAdmin(user.id)
}

export async function getPlatformAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

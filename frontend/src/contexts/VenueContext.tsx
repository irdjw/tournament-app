import { createContext, useContext } from 'react'

export interface VenueCtx {
  id: string
  name: string
  slug: string
}

export const VenueContext = createContext<VenueCtx | null>(null)

export function useVenue(): VenueCtx {
  const ctx = useContext(VenueContext)
  if (!ctx) throw new Error('useVenue must be used within VenueLayout')
  return ctx
}

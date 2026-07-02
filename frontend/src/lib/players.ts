import { supabase } from './supabase'

export interface Player {
  id: string
  name: string
}

/**
 * Gets or creates a walk-up player record by display name.
 *
 * Single shared implementation — previously duplicated in tournaments.ts,
 * fixtures.js, and inline in MatchSetup. Identity is keyed on a synthetic
 * email derived from the normalised name, so "Bob Smith" and "bob smith"
 * resolve to the same player. (A proper venue-scoped players table is the
 * long-term fix — see CODE_REVIEW.md §1.7.)
 */
export async function getOrCreatePlayer(name: string): Promise<Player> {
  const trimmed = name.trim()
  const email = `${trimmed.toLowerCase().replace(/\s+/g, '')}@temp.com`
  const { data, error } = await supabase
    .from('users')
    .upsert({ name: trimmed, email }, { onConflict: 'email' })
    .select('id, name')
    .single()
  if (error) throw error
  return data as Player
}

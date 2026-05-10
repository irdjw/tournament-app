/**
 * Minimal supabase stub — satisfies the module import in tournaments.ts so
 * pure-function tests don't attempt a real network connection.
 *
 * DB-touching functions (createTournament, generateGroupStage, etc.) are NOT
 * called by any unit test; they are covered only in integration tests.
 */
export const supabase = {
  from: () => { throw new Error('supabase.from called in unit test — use integration tests for DB operations') },
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: () => Promise.resolve({ data: null, error: null }),
    signInWithOtp: () => Promise.resolve({ data: null, error: null }),
    signOut: () => Promise.resolve({ error: null }),
  },
  channel: () => ({
    on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
    subscribe: () => ({ unsubscribe: () => {} }),
    unsubscribe: () => {},
  }),
  removeChannel: () => {},
}

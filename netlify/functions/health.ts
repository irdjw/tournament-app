import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const handler: Handler = async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  let supabaseOk = false

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { error } = await supabase.from('venues').select('id').limit(1)
      supabaseOk = !error
    } catch {
      supabaseOk = false
    }
  }

  const body = JSON.stringify({
    status: 'ok',
    supabase: supabaseOk,
    timestamp: new Date().toISOString(),
  })

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body,
  }
}

export { handler }

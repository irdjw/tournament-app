import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getVenueAdmin } from '../lib/auth'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')

    if (!code) {
      navigate('/login?error=callback-failed')
      return
    }

    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error || !data.session) {
        navigate('/login?error=callback-failed')
        return
      }
      const va = await getVenueAdmin(data.session.user.id)
      navigate(va ? '/admin' : '/login?error=no-venue', { replace: true })
    })
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Signing you in…</div>
    </div>
  )
}

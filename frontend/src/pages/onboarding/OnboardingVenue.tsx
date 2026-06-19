import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function findAvailableSlug(base: string): Promise<string> {
  let slug = base
  let n = 1
  while (true) {
    const { data } = await supabase.from('venues').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
    slug = `${base}-${++n}`
  }
}

const PENDING_KEY = 'pending_onboarding_venue'

export default function OnboardingVenue() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ venueName: '', yourName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  // Resume onboarding if user lands back here after confirming their email
  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_KEY)
    if (!pending) return
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) return
      const saved = JSON.parse(pending)
      setForm(f => ({ ...f, venueName: saved.venueName, yourName: saved.yourName }))
      sessionStorage.removeItem(PENDING_KEY)
      createVenueAndAdmin(data.session.user.id, saved.venueName)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { name: form.yourName.trim() },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      const user = authData.user
      if (!user) {
        setError('Account creation failed. Please try again.')
        setLoading(false)
        return
      }

      if (!authData.session) {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({
          venueName: form.venueName.trim(),
          yourName: form.yourName.trim(),
        }))
        setNeedsConfirmation(true)
        setLoading(false)
        return
      }

      await createVenueAndAdmin(user.id, form.venueName.trim())
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  async function createVenueAndAdmin(userId: string, venueName = form.venueName.trim()) {
    const slug = await findAvailableSlug(toSlug(venueName))

    const { data: venueData, error: venueError } = await supabase
      .from('venues')
      .insert({ name: venueName, slug })
      .select('id, slug')
      .single()

    if (venueError || !venueData) {
      setError('Could not create venue. Please try again.')
      setLoading(false)
      return
    }

    const { error: adminError } = await supabase
      .from('venue_admins')
      .insert({ user_id: userId, venue_id: venueData.id, role: 'admin' })

    if (adminError) {
      setError('Could not link your account to the venue. Please try again.')
      setLoading(false)
      return
    }

    sessionStorage.setItem('onboarding', JSON.stringify({
      venueId: venueData.id,
      venueSlug: venueData.slug,
      venueName: venueName,
      userId,
      sports: [],
      sportIds: {},
    }))

    navigate('/onboarding/sport')
  }

  if (needsConfirmation) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-4">📧</div>
        <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
          We sent a confirmation link to <strong className="text-white">{form.email}</strong>. Click it to activate your account, then come back here to continue setup.
        </p>
        <p className="text-xs text-gray-600">
          Already confirmed?{' '}
          <button
            onClick={async () => {
              setLoading(true)
              const { data } = await supabase.auth.getSession()
              if (data.session?.user) {
                await createVenueAndAdmin(data.session.user.id)
              } else {
                setError('Session not found. Please sign in.')
                setNeedsConfirmation(false)
                setLoading(false)
              }
            }}
            className="text-purple-400 hover:text-purple-300 underline transition-colors"
          >
            Continue setup
          </button>
        </p>
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Set up your venue</h1>
      <p className="text-gray-400 text-sm mb-8">Takes about 2 minutes.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Venue name</label>
          <input
            type="text"
            required
            placeholder="The Southfield Arms"
            value={form.venueName}
            onChange={set('venueName')}
            className="w-full rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Your name</label>
          <input
            type="text"
            required
            placeholder="Dave"
            value={form.yourName}
            onChange={set('yourName')}
            className="w-full rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Email address</label>
          <input
            type="email"
            required
            placeholder="dave@thesouthfield.com"
            value={form.email}
            onChange={set('email')}
            className="w-full rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
          <input
            type="password"
            required
            minLength={8}
            placeholder="Min. 8 characters"
            value={form.password}
            onChange={set('password')}
            className="w-full rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors mt-2"
        >
          {loading ? 'Creating your venue…' : 'Continue'}
        </button>
      </form>

      <p className="text-xs text-gray-600 text-center mt-6">
        By signing up you agree to our terms. First month free, no card required.
      </p>
    </div>
  )
}

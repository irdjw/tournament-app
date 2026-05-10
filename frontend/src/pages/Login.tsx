import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getVenueAdmin } from '../lib/auth'

type Mode = 'password' | 'magic'

const errorMessages: Record<string, string> = {
  'no-venue': 'Your account is not linked to a venue. Contact your administrator.',
  'callback-failed': 'Login link expired or already used. Please try again.',
}

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const urlError = new URLSearchParams(window.location.search).get('error')
  const displayError = error ?? (urlError ? errorMessages[urlError] ?? urlError : null)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      const msg = signInError.message.toLowerCase()
      if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
        setError('Incorrect email or password.')
      } else if (msg.includes('email not confirmed')) {
        setError('Please verify your email address before signing in.')
      } else {
        setError(signInError.message)
      }
      setIsLoading(false)
      return
    }

    if (data.user) {
      const va = await getVenueAdmin(data.user.id)
      if (va) {
        navigate('/admin')
      } else {
        await supabase.auth.signOut()
        navigate('/login?error=no-venue')
      }
    }
    setIsLoading(false)
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (otpError) {
      setError(otpError.message)
    } else {
      setMagicLinkSent(true)
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-400 transition-colors block mb-6">
            ← Back to home
          </Link>
          <h1 className="text-2xl font-semibold text-white">Sign in</h1>
          <p className="mt-1 text-sm text-gray-400">Venue admin access</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800">
          {displayError && (
            <div className="mb-4 rounded-lg bg-red-900/40 border border-red-700/50 px-4 py-3 text-sm text-red-300">
              {displayError}
            </div>
          )}

          {magicLinkSent ? (
            <div className="text-center py-2">
              <p className="text-sm text-gray-300">
                Check your inbox — we sent a login link to
              </p>
              <p className="mt-1 font-medium text-white">{email}</p>
              <button
                onClick={() => { setMagicLinkSent(false); setError(null) }}
                className="mt-4 text-sm text-purple-400 hover:text-purple-300"
              >
                Use a different method
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs */}
              <div className="flex rounded-lg bg-gray-800 p-1 mb-5">
                {(['password', 'magic'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(null) }}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                      mode === m
                        ? 'bg-gray-700 text-white shadow'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {m === 'password' ? 'Password' : 'Magic link'}
                  </button>
                ))}
              </div>

              <form onSubmit={mode === 'password' ? handleSignIn : handleMagicLink} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>

                {mode === 'password' && (
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="••••••••"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition-colors mt-2"
                >
                  {isLoading
                    ? 'Please wait…'
                    : mode === 'password'
                    ? 'Sign in'
                    : 'Email me a login link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

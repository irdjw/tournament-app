import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'

interface OnboardingData {
  venueId: string
  venueSlug: string
  venueName: string
  userId: string
  sports: string[]
  sportIds: Record<string, string>
}

function getOnboarding(): OnboardingData | null {
  try { return JSON.parse(sessionStorage.getItem('onboarding') ?? 'null') } catch { return null }
}

export default function OnboardingDone() {
  const [ob] = useState(getOnboarding)
  const [copied, setCopied] = useState(false)

  const slug = ob?.venueSlug ?? ''
  const publicUrl = `${window.location.origin}/v/${slug}`

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Copy this link:', publicUrl)
    }
  }

  const NEXT_STEPS = [
    {
      title: 'Start a league night',
      desc: 'Set up fixtures and run your first round.',
      icon: '📅',
      href: '/bar/league/setup',
      accent: 'border-blue-800/50 hover:border-blue-600/60',
    },
    {
      title: 'Run a tournament',
      desc: 'Single or double elimination, group stages.',
      icon: '🏆',
      href: '/bar/tournament/new',
      accent: 'border-purple-800/50 hover:border-purple-600/60',
    },
    {
      title: 'View your public page',
      desc: 'Share live scores, standings and fixtures.',
      icon: '🌐',
      href: `/v/${slug}`,
      accent: 'border-green-800/50 hover:border-green-600/60',
    },
  ]

  return (
    <div className="text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h1 className="text-2xl font-bold text-white mb-2">{"You're set up!"}</h1>
      <p className="text-gray-400 text-sm mb-10">
        {ob?.venueName ? `${ob.venueName} is ready to go.` : 'Your venue is ready to go.'}
      </p>

      {/* Next steps */}
      <div className="grid grid-cols-1 gap-3 mb-10 text-left">
        {NEXT_STEPS.map(step => (
          <Link
            key={step.href}
            to={step.href}
            className={`flex items-center gap-4 px-5 py-4 bg-gray-900 border-2 ${step.accent} rounded-2xl transition-colors group`}
          >
            <span className="text-2xl">{step.icon}</span>
            <div className="flex-1">
              <p className="font-semibold text-white text-sm">{step.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
            </div>
            <span className="text-gray-600 group-hover:text-gray-400 transition-colors">→</span>
          </Link>
        ))}
      </div>

      {/* Share your page */}
      {slug && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left">
          <h2 className="text-sm font-semibold text-white mb-4 text-center">Share your venue page</h2>
          <div className="flex justify-center mb-4">
            <div className="bg-white rounded-xl p-3">
              <QRCodeSVG value={publicUrl} size={120} />
            </div>
          </div>
          <p className="text-xs text-gray-500 text-center mb-3">
            Players scan this to follow live scores on their phone
          </p>
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2.5">
            <span className="flex-1 text-xs text-gray-300 truncate font-mono">{publicUrl}</span>
            <button
              onClick={copyUrl}
              className="text-xs text-purple-400 hover:text-purple-300 font-medium shrink-0 transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8">
        <Link to="/admin" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          Go to admin dashboard →
        </Link>
      </div>
    </div>
  )
}

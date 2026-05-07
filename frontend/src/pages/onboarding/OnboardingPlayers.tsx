import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function getOnboarding() {
  try { return JSON.parse(sessionStorage.getItem('onboarding') ?? 'null') } catch { return null }
}

export default function OnboardingPlayers() {
  const navigate = useNavigate()
  const [players, setPlayers] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!getOnboarding()) navigate('/onboarding', { replace: true })
  }, [navigate])

  function addPlayer() {
    const name = input.trim()
    if (!name || players.includes(name)) return
    setPlayers(p => [...p, name])
    setInput('')
  }

  function addFromPaste() {
    const names = pasteText.split('\n').map(s => s.trim()).filter(Boolean)
    setPlayers(p => {
      const combined = [...p]
      for (const n of names) if (!combined.includes(n)) combined.push(n)
      return combined
    })
    setPasteText('')
    setPasteMode(false)
  }

  function remove(name: string) {
    setPlayers(p => p.filter(n => n !== name))
  }

  async function handleFinish() {
    setLoading(true)
    for (const name of players) {
      try { await supabase.from('users').insert({ name }) } catch {}
    }
    setLoading(false)
    navigate('/onboarding/done')
  }

  const pasteCount = pasteText.split('\n').filter(s => s.trim()).length

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Add your players</h1>
      <p className="text-gray-400 text-sm mb-8">You can add or import more from the admin panel at any time.</p>

      {/* Single add */}
      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPlayer())}
          placeholder="Player name"
          className="flex-1 rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={addPlayer}
          disabled={!input.trim()}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
        >
          Add
        </button>
      </div>

      {/* Paste toggle */}
      {!pasteMode ? (
        <button
          onClick={() => setPasteMode(true)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors mb-6 block"
        >
          Paste a list of names instead →
        </button>
      ) : (
        <div className="mb-6 bg-gray-900 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-2">One name per line</p>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={'Dave\nSteve\nMike\nChris'}
            rows={5}
            className="w-full bg-transparent text-white placeholder-gray-700 text-sm focus:outline-none resize-none font-mono"
          />
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
            <button
              onClick={addFromPaste}
              disabled={pasteCount === 0}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
            >
              Add {pasteCount > 0 ? `${pasteCount} player${pasteCount !== 1 ? 's' : ''}` : 'players'}
            </button>
            <button
              onClick={() => { setPasteMode(false); setPasteText('') }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Player list */}
      {players.length > 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800 mb-6">
          {players.map(name => (
            <div key={name} className="flex items-center justify-between px-4 py-3">
              <span className="text-white text-sm">{name}</span>
              <button
                onClick={() => remove(name)}
                className="text-gray-600 hover:text-red-400 text-sm transition-colors"
                aria-label={`Remove ${name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : !pasteMode && (
        <div className="border border-dashed border-gray-800 rounded-xl px-6 py-8 text-center text-gray-600 text-sm mb-6">
          No players added yet
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => navigate('/onboarding/done')}
          className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={handleFinish}
          disabled={loading}
          className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors"
        >
          {loading
            ? 'Saving…'
            : players.length > 0
            ? `Add ${players.length} player${players.length !== 1 ? 's' : ''} & finish`
            : 'Finish'}
        </button>
      </div>
    </div>
  )
}

import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createTournament,
  generateTournamentStructure,
  startTournament,
  previewGroups,
  getOrCreateUser,
  type TournamentFormat,
  type TournamentConfig,
  type Player,
  type GroupPreview,
} from '../../../lib/tournaments'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3

// ─── Step 1 — Details ────────────────────────────────────────────────────────

function StepDetails({
  onNext,
}: {
  onNext: (name: string, sport: string, format: TournamentFormat, config: TournamentConfig) => void
}) {
  const [name, setName] = useState('')
  const [sport, setSport] = useState<'darts' | 'pool'>('darts')
  const [format, setFormat] = useState<TournamentFormat>('single_elimination')
  const [legs, setLegs] = useState(3)
  const [startingScore, setStartingScore] = useState<301 | 501>(501)
  const [doubleOut, setDoubleOut] = useState(true)
  const [groupSize, setGroupSize] = useState(4)
  const [error, setError] = useState('')

  const handleNext = () => {
    if (!name.trim()) { setError('Tournament name is required'); return }
    onNext(name.trim(), sport, format, { legs, startingScore, doubleOut, groupSize })
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-bold text-gray-200 mb-2">Tournament Name</label>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          placeholder="e.g. Friday Night Darts Open"
          className="w-full bg-gray-800 text-white text-lg border-2 border-gray-600 rounded-lg px-4 py-3 focus:border-amber-400 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-200 mb-2">Sport</label>
          <div className="flex gap-2">
            {(['darts', 'pool'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSport(s)}
                className={`flex-1 py-3 rounded-lg font-bold capitalize text-sm border-2 transition-colors ${
                  sport === s
                    ? 'bg-amber-500 border-amber-400 text-black'
                    : 'bg-gray-800 border-gray-600 text-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-200 mb-2">Starting Score</label>
          <div className="flex gap-2">
            {([301, 501] as const).map(s => (
              <button
                key={s}
                onClick={() => setStartingScore(s)}
                className={`flex-1 py-3 rounded-lg font-bold text-sm border-2 transition-colors ${
                  startingScore === s
                    ? 'bg-amber-500 border-amber-400 text-black'
                    : 'bg-gray-800 border-gray-600 text-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-200 mb-2">Format</label>
        <div className="flex flex-col gap-2">
          {([
            ['single_elimination', 'Single Elimination', 'One loss = eliminated'],
            ['double_elimination', 'Double Elimination', 'Two losses = eliminated'],
            ['group_stage', 'Group Stage + Brackets', 'Round-robin groups then knockout'],
          ] as const).map(([val, label, desc]) => (
            <button
              key={val}
              onClick={() => setFormat(val)}
              className={`text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                format === val
                  ? 'bg-amber-500 border-amber-400 text-black'
                  : 'bg-gray-800 border-gray-600 text-gray-300'
              }`}
            >
              <div className="font-bold">{label}</div>
              <div className={`text-xs ${format === val ? 'text-black/70' : 'text-gray-500'}`}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-200 mb-2">Legs</label>
          <select
            value={legs}
            onChange={e => setLegs(parseInt(e.target.value))}
            className="w-full bg-gray-800 text-white text-lg border-2 border-gray-600 rounded-lg px-4 py-3 focus:border-amber-400 focus:outline-none"
          >
            <option value={1}>1 leg</option>
            <option value={3}>Best of 3</option>
            <option value={5}>Best of 5</option>
            <option value={7}>Best of 7</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-200 mb-2">Double Out</label>
          <div className="flex gap-2">
            {([true, false] as const).map(v => (
              <button
                key={String(v)}
                onClick={() => setDoubleOut(v)}
                className={`flex-1 py-3 rounded-lg font-bold text-sm border-2 transition-colors ${
                  doubleOut === v
                    ? 'bg-amber-500 border-amber-400 text-black'
                    : 'bg-gray-800 border-gray-600 text-gray-300'
                }`}
              >
                {v ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {format === 'group_stage' && (
        <div>
          <label className="block text-sm font-bold text-gray-200 mb-2">Group Size</label>
          <div className="flex gap-2">
            {[3, 4, 5, 6].map(s => (
              <button
                key={s}
                onClick={() => setGroupSize(s)}
                className={`flex-1 py-3 rounded-lg font-bold text-sm border-2 transition-colors ${
                  groupSize === s
                    ? 'bg-amber-500 border-amber-400 text-black'
                    : 'bg-gray-800 border-gray-600 text-gray-300'
                }`}
              >
                {s} players
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-900 border border-red-500 rounded-lg text-red-200 text-sm">{error}</div>
      )}

      <button
        onClick={handleNext}
        className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black text-lg font-bold rounded-xl transition-colors"
      >
        Next: Add Players →
      </button>
    </div>
  )
}

// ─── Step 2 — Players ─────────────────────────────────────────────────────────

function StepPlayers({
  format,
  groupSize,
  onBack,
  onNext,
}: {
  format: TournamentFormat
  groupSize: number
  onBack: () => void
  onNext: (players: Player[]) => void
}) {
  const [players, setPlayers] = useState<Player[]>([])
  const [inputName, setInputName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<GroupPreview[]>([])
  const [groupsGenerated, setGroupsGenerated] = useState(false)
  const dragIndex = useRef<number | null>(null)

  const addPlayer = async () => {
    const name = inputName.trim()
    if (!name) return
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      setError('Player already added')
      return
    }
    setLoading(true)
    try {
      const user = await getOrCreateUser(name)
      setPlayers(prev => [...prev, user])
      setInputName('')
      setError('')
      setGroupsGenerated(false)
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to add player')
    } finally {
      setLoading(false)
    }
  }

  const removePlayer = (id: string) => {
    setPlayers(prev => prev.filter(p => p.id !== id))
    setGroupsGenerated(false)
  }

  const handleDragStart = (idx: number) => { dragIndex.current = idx }
  const handleDrop = (idx: number) => {
    if (dragIndex.current === null || dragIndex.current === idx) return
    const reordered = [...players]
    const [moved] = reordered.splice(dragIndex.current, 1)
    reordered.splice(idx, 0, moved)
    setPlayers(reordered)
    dragIndex.current = null
    setGroupsGenerated(false)
  }

  const generateGroups = () => {
    const preview = previewGroups(players, format, groupSize)
    setGroups(preview)
    setGroupsGenerated(true)
  }

  const canGenerate = players.length >= 4
  const recommendedGroups = format === 'group_stage' ? Math.ceil(players.length / groupSize) : null

  return (
    <div className="space-y-6">
      {/* Add player */}
      <div>
        <label className="block text-sm font-bold text-gray-200 mb-2">Add Player</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputName}
            onChange={e => { setInputName(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter') addPlayer() }}
            placeholder="Player name"
            className="flex-1 bg-gray-800 text-white text-lg border-2 border-gray-600 rounded-lg px-4 py-3 focus:border-amber-400 focus:outline-none"
          />
          <button
            onClick={addPlayer}
            disabled={loading || !inputName.trim()}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-bold rounded-lg transition-colors text-sm"
          >
            {loading ? '…' : 'Add'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
      </div>

      {/* Player count info */}
      {players.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{players.length} players</span>
          {format === 'group_stage' && recommendedGroups && (
            <span>→ {recommendedGroups} groups of ~{groupSize}</span>
          )}
          <span className="text-gray-600">· Drag to reorder (sets seeding)</span>
        </div>
      )}

      {/* Player list */}
      <div className="space-y-2">
        {players.map((p, idx) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 cursor-grab active:cursor-grabbing select-none"
          >
            <span className="text-amber-500 font-bold w-6 text-center text-sm">#{idx + 1}</span>
            <span className="text-gray-400 text-lg">⠿</span>
            <span className="flex-1 text-white font-medium text-base">{p.name}</span>
            <button
              onClick={() => removePlayer(p.id)}
              className="text-gray-500 hover:text-red-400 text-lg px-2 py-1 rounded transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
        {players.length === 0 && (
          <div className="text-center py-8 text-gray-600 border-2 border-dashed border-gray-700 rounded-lg">
            Add at least 4 players to continue
          </div>
        )}
      </div>

      {/* Generate groups */}
      <div className="space-y-3">
        <button
          onClick={generateGroups}
          disabled={!canGenerate}
          className="w-full py-4 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold rounded-xl transition-colors text-base"
        >
          {canGenerate ? 'Preview Groups / Bracket' : `Need ${Math.max(0, 4 - players.length)} more player${4 - players.length !== 1 ? 's' : ''}`}
        </button>

        {groupsGenerated && (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(groups.length, 3)}, 1fr)` }}>
            {groups.map(g => (
              <div key={g.name} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                <div className="text-amber-400 font-bold text-sm mb-2">{g.name}</div>
                {g.players.map((p, i) => (
                  <div key={p.id} className="text-gray-300 text-sm py-0.5">
                    {format === 'group_stage' ? p.name : `#${players.indexOf(p) + 1} ${p.name}`}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => onNext(players)}
          disabled={!groupsGenerated}
          className="flex-1 py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-800 disabled:text-gray-600 text-black font-bold rounded-xl transition-colors"
        >
          Next: Review →
        </button>
      </div>
    </div>
  )
}

// ─── Step 3 — Review & Start ──────────────────────────────────────────────────

function StepReview({
  name,
  sport,
  format,
  config,
  players,
  onBack,
  onStart,
  starting,
}: {
  name: string
  sport: string
  format: TournamentFormat
  config: TournamentConfig
  players: Player[]
  onBack: () => void
  onStart: () => void
  starting: boolean
}) {
  const groups = previewGroups(players, format, config.groupSize)
  const formatLabel: Record<TournamentFormat, string> = {
    single_elimination: 'Single Elimination',
    double_elimination: 'Double Elimination',
    group_stage: 'Group Stage + Brackets',
  }

  // Generate a text-based bracket preview
  const bracketPreview: string[] = []
  if (format === 'group_stage') {
    groups.forEach(g => {
      bracketPreview.push(`${g.name} (${g.players.length} players, round-robin)`)
    })
    bracketPreview.push('→ Top 2 from each group advance to knockout bracket')
  } else {
    const n = players.length
    if (n >= 2) {
      const roundMatches = Math.ceil(n / 2)
      for (let m = 0; m < roundMatches; m++) {
        const a = players[m]
        const bIdx = n - 1 - m
        const b = bIdx > m ? players[bIdx] : null
        if (b) {
          bracketPreview.push(`R1 M${m + 1}: ${a.name} vs ${b.name}`)
        } else {
          bracketPreview.push(`R1 M${m + 1}: ${a.name} (bye)`)
        }
      }
      if (format === 'double_elimination') {
        bracketPreview.push('→ Losers enter Losers Bracket')
        bracketPreview.push('→ Grand Final: Winners Bracket champion vs Losers Bracket champion')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
        <h3 className="text-white font-bold text-lg">{name}</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <span className="text-gray-400">Sport</span>
          <span className="text-white capitalize">{sport}</span>
          <span className="text-gray-400">Format</span>
          <span className="text-white">{formatLabel[format]}</span>
          <span className="text-gray-400">Legs</span>
          <span className="text-white">{config.legs === 1 ? '1 leg' : `Best of ${config.legs}`}</span>
          <span className="text-gray-400">Starting score</span>
          <span className="text-white">{config.startingScore}</span>
          <span className="text-gray-400">Double out</span>
          <span className="text-white">{config.doubleOut ? 'Yes' : 'No'}</span>
          <span className="text-gray-400">Players</span>
          <span className="text-white">{players.length}</span>
        </div>
      </div>

      {/* Group assignments */}
      {format === 'group_stage' && (
        <div>
          <h3 className="text-amber-400 font-bold mb-3">Group Assignments</h3>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(groups.length, 3)}, 1fr)` }}>
            {groups.map(g => (
              <div key={g.name} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                <div className="text-amber-400 font-bold text-sm mb-2">{g.name}</div>
                {g.players.map(p => (
                  <div key={p.id} className="text-gray-300 text-sm py-0.5">{p.name}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bracket preview */}
      <div>
        <h3 className="text-amber-400 font-bold mb-3">
          {format === 'group_stage' ? 'Group Stage Preview' : 'Bracket Preview'}
        </h3>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-1.5">
          {bracketPreview.map((line, i) => (
            <div key={i} className={`text-sm ${line.startsWith('→') ? 'text-amber-400 mt-2' : 'text-gray-300'}`}>
              {line}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={starting}
          className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-bold rounded-xl transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onStart}
          disabled={starting}
          className="flex-1 py-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-800 text-white text-lg font-bold rounded-xl transition-colors"
        >
          {starting ? 'Creating…' : '🏆 Start Tournament'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function NewTournament() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  // Collected state across steps
  const [detailName, setDetailName] = useState('')
  const [detailSport, setDetailSport] = useState('darts')
  const [detailFormat, setDetailFormat] = useState<TournamentFormat>('single_elimination')
  const [detailConfig, setDetailConfig] = useState<TournamentConfig>({ legs: 3, startingScore: 501, doubleOut: true, groupSize: 4 })
  const [players, setPlayers] = useState<Player[]>([])

  const stepLabels = ['Details', 'Players', 'Review']

  const handleStep1 = (name: string, sport: string, format: TournamentFormat, config: TournamentConfig) => {
    setDetailName(name)
    setDetailSport(sport)
    setDetailFormat(format)
    setDetailConfig(config)
    setStep(2)
  }

  const handleStep2 = (ps: Player[]) => {
    setPlayers(ps)
    setStep(3)
  }

  const handleStart = async () => {
    setStarting(true)
    setError('')
    try {
      const tournament = await createTournament(detailName, detailFormat, detailSport, detailConfig)
      await generateTournamentStructure(tournament.id, players, detailFormat, detailConfig)
      await startTournament(tournament.id)
      navigate(`/bar/tournament/${tournament.id}`)
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create tournament')
      setStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">New Tournament</h1>
          <p className="text-gray-400 text-sm">Set up a new tournament in {stepLabels.length} steps</p>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {stepLabels.map((label, i) => {
            const s = (i + 1) as Step
            return (
              <div key={label} className="flex-1 flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-colors ${
                  step === s ? 'bg-amber-500 text-black' :
                  step > s ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'
                }`}>
                  {step > s ? '✓' : s}
                </div>
                <div className={`text-xs ${step === s ? 'text-amber-400 font-medium' : 'text-gray-600'}`}>{label}</div>
              </div>
            )
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-500 rounded-lg text-red-200 text-sm">{error}</div>
        )}

        {step === 1 && <StepDetails onNext={handleStep1} />}
        {step === 2 && (
          <StepPlayers
            format={detailFormat}
            groupSize={detailConfig.groupSize}
            onBack={() => setStep(1)}
            onNext={handleStep2}
          />
        )}
        {step === 3 && (
          <StepReview
            name={detailName}
            sport={detailSport}
            format={detailFormat}
            config={detailConfig}
            players={players}
            onBack={() => setStep(2)}
            onStart={handleStart}
            starting={starting}
          />
        )}
      </div>
    </div>
  )
}

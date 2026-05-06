import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  getTournamentFull,
  type Tournament,
  type TournamentGroup,
  type TournamentMatch,
  type TournamentParticipant,
} from '../lib/tournaments'

export interface UseTournamentResult {
  tournament: Tournament | null
  groups: TournamentGroup[]
  matches: TournamentMatch[]
  participants: TournamentParticipant[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useTournament(tournamentId: string | undefined): UseTournamentResult {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [groups, setGroups] = useState<TournamentGroup[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [participants, setParticipants] = useState<TournamentParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const load = async () => {
    if (!tournamentId) return
    try {
      const data = await getTournamentFull(tournamentId)
      setTournament(data.tournament)
      setGroups(data.groups)
      setMatches(data.matches)
      setParticipants(data.participants)
      setError(null)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load tournament')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!tournamentId) return
    setLoading(true)
    load()
    channelRef.current = supabase
      .channel(`tournament-hook-${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`,
      }, load)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournamentId}`,
      }, load)
      .subscribe()
    return () => { channelRef.current?.unsubscribe() }
  }, [tournamentId])

  return { tournament, groups, matches, participants, loading, error, reload: load }
}

export function useActiveTournamentMatches(tournamentId: string | undefined) {
  const { matches, loading, error } = useTournament(tournamentId)
  return {
    matches: matches.filter(m => m.status === 'in_progress'),
    loading,
    error,
  }
}

export interface BracketData {
  winnersGroup: TournamentGroup | undefined
  losersGroup: TournamentGroup | undefined
  grandFinalGroup: TournamentGroup | undefined
  winnersByRound: Map<number, TournamentMatch[]>
  losersByRound: Map<number, TournamentMatch[]>
  grandFinalMatches: TournamentMatch[]
  loading: boolean
  error: string | null
}

export function useBracket(tournamentId: string | undefined): BracketData {
  const { groups, matches, loading, error } = useTournament(tournamentId)

  const winnersGroup = groups.find(g => g.group_type === 'winners')
  const losersGroup = groups.find(g => g.group_type === 'losers')
  const grandFinalGroup = groups.find(g => g.group_type === 'grand_final')

  const byRound = (groupId: string | undefined): Map<number, TournamentMatch[]> => {
    const map = new Map<number, TournamentMatch[]>()
    if (!groupId) return map
    for (const m of matches.filter(m => m.group_id === groupId)) {
      if (!map.has(m.round)) map.set(m.round, [])
      map.get(m.round)!.push(m)
    }
    return map
  }

  return {
    winnersGroup,
    losersGroup,
    grandFinalGroup,
    winnersByRound: byRound(winnersGroup?.id),
    losersByRound: byRound(losersGroup?.id),
    grandFinalMatches: grandFinalGroup
      ? matches.filter(m => m.group_id === grandFinalGroup.id)
      : [],
    loading,
    error,
  }
}

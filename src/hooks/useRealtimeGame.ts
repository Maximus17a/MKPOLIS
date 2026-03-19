'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useGameStore } from '@/store/useGameStore';
import type { Game, Player, Property, GameLog } from '@/lib/database.types';

/**
 * Subscribe to Supabase Realtime changes for a game.
 * Keeps the Zustand store in sync with the database (source of truth).
 * On receiving server updates, clears any pending optimistic state.
 */
export function useRealtimeGame(gameId: string | null) {
  const store = useGameStore();

  useEffect(() => {
    if (!gameId) return;
    const supabase = createClient();

    const poll = async () => {
      const [{ data: game }, { data: players }, { data: properties }, { data: logs }] =
        await Promise.all([
          supabase.from('games').select('*').eq('id', gameId).single(),
          supabase.from('players').select('*').eq('game_id', gameId).order('turn_order'),
          supabase.from('properties').select('*').eq('game_id', gameId),
          supabase.from('game_logs').select('*').eq('game_id', gameId).order('created_at').limit(100),
        ]);
      if (game) {
        const s = useGameStore.getState();
        // Auto-clear pendingRent when turn changes away from us
        if (s.pendingRent && game.current_turn_player_id !== s.myPlayerId) {
          useGameStore.setState({ pendingRent: null });
        }
        s.setGame(game);
        s.clearOptimistic();
      }
      if (players) {
        players.forEach((p) => useGameStore.getState().updatePlayer(p as Player));
      }
      if (properties) {
        properties.forEach((p) => useGameStore.getState().updateProperty(p as Property));
      }
      if (logs) {
        const currentLogIds = new Set(useGameStore.getState().logs.map((l) => l.id));
        (logs as GameLog[]).forEach((l) => {
          if (!currentLogIds.has(l.id)) useGameStore.getState().addLog(l);
        });
      }
    };

    // Always poll every 2s — primary sync mechanism (WebSocket is bonus)
    const pollingInterval = setInterval(poll, 2000);

    // Also subscribe to realtime for lower-latency updates when WebSocket works
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const s = useGameStore.getState();
            const newGame = payload.new as Game;
            if (s.pendingRent && newGame.current_turn_player_id !== s.myPlayerId) {
              useGameStore.setState({ pendingRent: null });
            }
            s.setGame(newGame);
            s.clearOptimistic();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPlayer = payload.new as Player;
            const exists = useGameStore.getState().players.some((p) => p.id === newPlayer.id);
            if (!exists) {
              useGameStore.setState((s) => ({ players: [...s.players, newPlayer] }));
            }
          } else if (payload.eventType === 'UPDATE') {
            useGameStore.getState().updatePlayer(payload.new as Player);
            useGameStore.getState().clearOptimistic();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties', filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newProp = payload.new as Property;
            const exists = useGameStore.getState().properties.some((p) => p.id === newProp.id);
            if (!exists) {
              useGameStore.setState((s) => ({ properties: [...s.properties, newProp] }));
            }
          } else if (payload.eventType === 'UPDATE') {
            useGameStore.getState().updateProperty(payload.new as Property);
            useGameStore.getState().clearOptimistic();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_logs', filter: `game_id=eq.${gameId}` },
        (payload) => {
          const log = payload.new as GameLog;
          const exists = useGameStore.getState().logs.some((l) => l.id === log.id);
          if (!exists) useGameStore.getState().addLog(log);
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps
}

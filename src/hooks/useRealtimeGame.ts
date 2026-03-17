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

    const channel = supabase
      .channel(`game:${gameId}`)
      // Games table
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            store.setGame(payload.new as Game);
            store.clearOptimistic();
          }
        }
      )
      // Players table
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPlayer = payload.new as Player;
            const exists = store.players.some((p) => p.id === newPlayer.id);
            if (!exists) {
              useGameStore.setState((s) => ({ players: [...s.players, newPlayer] }));
            }
          } else if (payload.eventType === 'UPDATE') {
            store.updatePlayer(payload.new as Player);
            store.clearOptimistic();
          }
        }
      )
      // Properties table
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties', filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newProp = payload.new as Property;
            const exists = store.properties.some((p) => p.id === newProp.id);
            if (!exists) {
              useGameStore.setState((s) => ({ properties: [...s.properties, newProp] }));
            }
          } else if (payload.eventType === 'UPDATE') {
            store.updateProperty(payload.new as Property);
            store.clearOptimistic();
          }
        }
      )
      // Game logs
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_logs', filter: `game_id=eq.${gameId}` },
        (payload) => {
          store.addLog(payload.new as GameLog);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps
}

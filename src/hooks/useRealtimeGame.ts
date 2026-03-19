'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useGameStore } from '@/store/useGameStore';
import type { Player, Property, GameLog } from '@/lib/database.types';

/**
 * Sync game state via polling every 2s.
 * WebSocket realtime is intentionally disabled — it causes reconnect spam
 * with multiple concurrent players. Polling is reliable and sufficient.
 */
export function useRealtimeGame(gameId: string | null) {
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

      const s = useGameStore.getState();

      if (game) {
        // Auto-clear pendingRent when turn changes away from us
        if (s.pendingRent && game.current_turn_player_id !== s.myPlayerId) {
          useGameStore.setState({ pendingRent: null });
        }
        // Also clear skull_king prediction if it's no longer our turn
        if (s.dicePrediction && game.current_turn_player_id !== s.myPlayerId) {
          useGameStore.setState({ dicePrediction: null });
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

    // Poll immediately on mount, then every 2s
    poll();
    const interval = setInterval(poll, 2000);

    return () => clearInterval(interval);
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps
}

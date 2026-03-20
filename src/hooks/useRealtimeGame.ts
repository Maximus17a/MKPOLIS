'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useGameStore } from '@/store/useGameStore';
import { getEventById } from '@/lib/game/events-data';
import type { Player, Property, GameLog } from '@/lib/database.types';

const SKIP_TURN_AFTER_MS = 90_000; // 90 seconds idle in roll phase

/**
 * Sync game state via polling every 2s.
 * WebSocket realtime is intentionally disabled — it causes reconnect spam
 * with multiple concurrent players. Polling is reliable and sufficient.
 */
export function useRealtimeGame(gameId: string | null) {
  // Track when we first saw the current roll-phase for a given player
  const rollPhaseStartRef = useRef<{ playerId: string; since: number } | null>(null);

  useEffect(() => {
    if (!gameId) return;
    const supabase = createClient();

    const poll = async () => {
      const [{ data: game }, { data: players }, { data: properties }, { data: logs }] =
        await Promise.all([
          supabase.from('games').select('*').eq('id', gameId).single(),
          supabase.from('players').select('*').eq('game_id', gameId).order('turn_order'),
          supabase.from('properties').select('*').eq('game_id', gameId),
          supabase.from('game_logs').select('*').eq('game_id', gameId).order('created_at', { ascending: false }).limit(100),
        ]);

      const s = useGameStore.getState();

      if (game) {
        // ── Disconnected player detection ──
        const myPlayerId = useGameStore.getState().myPlayerId;
        const isRollPhase = game.status === 'in_progress' && game.turn_phase === 'roll';
        const currentTurnId = game.current_turn_player_id;

        if (isRollPhase && currentTurnId && currentTurnId !== myPlayerId) {
          // Track when this player's roll phase started
          if (rollPhaseStartRef.current?.playerId !== currentTurnId) {
            rollPhaseStartRef.current = { playerId: currentTurnId, since: Date.now() };
          } else {
            const elapsed = Date.now() - rollPhaseStartRef.current.since;
            if (elapsed >= SKIP_TURN_AFTER_MS && myPlayerId) {
              // Auto-skip — only one player needs to fire this (server uses OCC so duplicates are safe)
              rollPhaseStartRef.current = null;
              fetch('/api/game/skip-turn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId, callerId: myPlayerId }),
              }).catch(() => {});
            }
          }
        } else {
          // Turn changed or it's my turn — reset tracker
          if (rollPhaseStartRef.current?.playerId !== currentTurnId) {
            rollPhaseStartRef.current = null;
          }
        }

        const prevTurnPlayerId = s.game?.current_turn_player_id;

        // Auto-clear pendingRent when turn changes away from us
        if (s.pendingRent && game.current_turn_player_id !== s.myPlayerId) {
          useGameStore.setState({ pendingRent: null });
        }
        // Also clear skull_king prediction if it's no longer our turn
        if (s.dicePrediction && game.current_turn_player_id !== s.myPlayerId) {
          useGameStore.setState({ dicePrediction: null });
        }
        // Clear spectator event when the active player's turn ends
        if (s.spectatorEvent && prevTurnPlayerId !== game.current_turn_player_id) {
          useGameStore.setState({ spectatorEvent: null });
        }
        s.setGame(game);
        s.clearOptimistic();
      }

      if (players) {
        const store = useGameStore.getState();
        const currentPlayerIds = new Set(store.players.map((p) => p.id));
        const hasNewPlayers = (players as Player[]).some((p) => !currentPlayerIds.has(p.id));

        // Replace full list so newly joined players appear immediately
        store.setPlayers(players as Player[]);

        // Re-fetch profiles when someone new joins (waiting room / mid-game join)
        if (hasNewPlayers) {
          const userIds = (players as Player[]).map((p) => p.user_id);
          supabase.from('profiles').select('*').in('id', userIds).then(({ data: profiles }) => {
            if (profiles) useGameStore.getState().setProfiles(profiles);
          });
        }
      }

      if (properties) {
        properties.forEach((p) => useGameStore.getState().updateProperty(p as Property));
      }

      if (logs) {
        const s = useGameStore.getState();
        const currentLogIds = new Set(s.logs.map((l) => l.id));
        // Reverse to chronological order (query returns newest-first)
        const sortedLogs = [...(logs as GameLog[])].reverse();

        // Spectator event detection — show event modal for players who aren't rolling
        const newEventLogs = sortedLogs.filter(
          (l) => l.action_type === 'event_shown' && !currentLogIds.has(l.id)
        );
        if (newEventLogs.length > 0 && s.game?.current_turn_player_id !== s.myPlayerId) {
          const latest = newEventLogs[newEventLogs.length - 1];
          const event = getEventById(latest.message);
          if (event) useGameStore.setState({ spectatorEvent: event });
        }

        sortedLogs.forEach((l) => {
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

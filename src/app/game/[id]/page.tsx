'use client';

import { useEffect, useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { useRealtimeGame } from '@/hooks/useRealtimeGame';
import { createClient } from '@/lib/supabase-client';
import GameBoard from '@/components/GameBoard';
import DiceRoller from '@/components/DiceRoller';
import PlayerPanel from '@/components/PlayerPanel';
import PropertyCard from '@/components/PropertyCard';
import GameLog from '@/components/GameLog';
import ActionBar from '@/components/ActionBar';
import EmotePanel from '@/components/EmotePanel';
import EmoteBubble from '@/components/EmoteBubble';
import ChatPanel from '@/components/ChatPanel';

export default function GamePage() {
  const params = useParams();
  const gameId = params.id as string;
  const store = useGameStore();

  // Subscribe to realtime updates
  useRealtimeGame(gameId);

  // Initial data load
  useEffect(() => {
    async function loadGame() {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) store.setMyUserId(user.id);

      const [{ data: game }, { data: players }, { data: properties }, { data: logs }, { data: cards }] =
        await Promise.all([
          supabase.from('games').select('*').eq('id', gameId).single(),
          supabase.from('players').select('*').eq('game_id', gameId).order('turn_order'),
          supabase.from('properties').select('*').eq('game_id', gameId),
          supabase.from('game_logs').select('*').eq('game_id', gameId).order('created_at'),
          supabase.from('player_cards').select('*').eq('game_id', gameId).eq('is_used', false),
        ]);

      if (game) store.setGame(game);
      if (players) {
        store.setPlayers(players);
        const myPlayer = players.find((p) => p.user_id === user?.id);
        if (myPlayer) store.setMyPlayerId(myPlayer.id);

        // Load profiles for all players
        const userIds = players.map((p) => p.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        if (profiles) store.setProfiles(profiles);
      }
      if (properties) store.setProperties(properties);
      if (logs) store.setLogs(logs);
      if (cards) store.setCards(cards);
    }

    loadGame();
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [starting, setStarting] = useState(false);

  const handleStartGame = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, hostUserId: store.myUserId }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error('Start failed:', data.error);
      }
    } catch (err) {
      console.error('Start failed:', err);
    } finally {
      setStarting(false);
    }
  }, [gameId, store.myUserId, starting]);

  // ─── API Call Wrappers with Optimistic Updates ───

  const handleRoll = useCallback(async () => {
    const player = store.myPlayer();
    if (!player) return;

    try {
      const res = await fetch('/api/game/roll-dice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId: player.id, doublesCount: store.doublesCount }),
      });

      if (res.status === 409) {
        store.rollbackToSnapshot();
        return;
      }

      const data = await res.json();
      if (data.dice) {
        store.setDiceResult(data.dice);
      }
      // Track doubles count for re-roll logic
      store.setDoublesCount(data.doublesCount ?? 0);
      // Realtime will sync the authoritative state
    } catch {
      store.rollbackToSnapshot();
    }
  }, [gameId, store]);

  const handleBuy = useCallback(async () => {
    const player = store.myPlayer();
    if (!player) return;

    const tile = (await import('@/data/board')).BOARD_TILES[player.position_index];
    if (!tile.price) return;

    // Optimistic
    store.optimisticBuyProperty(player.position_index, player.id, tile.price);

    try {
      const res = await fetch('/api/game/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId: player.id }),
      });

      if (res.status === 409) {
        store.rollbackToSnapshot();
      }
    } catch {
      store.rollbackToSnapshot();
    }
  }, [gameId, store]);

  const handleEndTurn = useCallback(async () => {
    const player = store.myPlayer();
    if (!player) return;

    try {
      const res = await fetch('/api/game/end-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId: player.id }),
      });

      if (res.status === 409) {
        store.rollbackToSnapshot();
      }
      // Reset doubles on turn end
      store.setDoublesCount(0);
    } catch {
      store.rollbackToSnapshot();
    }
  }, [gameId, store]);

  const handleUsePower = useCallback(
    async (cardId: string, targetPlayerId?: string) => {
      const player = store.myPlayer();
      if (!player) return;

      try {
        const res = await fetch('/api/game/use-power', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, playerId: player.id, cardId, targetPlayerId }),
        });

        if (res.status === 409) {
          store.rollbackToSnapshot();
        }
      } catch {
        store.rollbackToSnapshot();
      }
    },
    [gameId, store]
  );

  // ─── Waiting Lobby ───
  const isHost = store.game?.host_id === store.myUserId;
  const playerCount = store.players.length;

  if (store.game?.status === 'waiting') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          className="relative z-10 text-center space-y-8 max-w-md mx-auto px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-2">
              MKpolis
            </h1>
            <p className="text-cyan-500/50 text-sm">Sala de espera</p>
          </div>

          {/* Game ID */}
          <div className="p-4 rounded-xl border border-cyan-900/30 bg-slate-900/60">
            <p className="text-xs text-cyan-500/50 mb-1">Codigo de partida</p>
            <p className="text-lg font-mono text-cyan-300 select-all">{gameId}</p>
            <p className="text-xs text-cyan-500/30 mt-2">Comparte este codigo para que otros se unan</p>
          </div>

          {/* Players */}
          <div className="space-y-2">
            <p className="text-xs text-cyan-500/60 uppercase tracking-widest">
              Jugadores ({playerCount}/6)
            </p>
            {store.players
              .slice()
              .sort((a, b) => a.turn_order - b.turn_order)
              .map((p) => (
                <motion.div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-cyan-900/20 bg-slate-900/40"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-black"
                    style={{ background: p.color }}
                  >
                    P{p.turn_order + 1}
                  </div>
                  <span className="text-sm text-cyan-200">
                    {store.getPlayerName(p)}
                  </span>
                  {p.user_id === store.game?.host_id && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 ml-auto">
                      HOST
                    </span>
                  )}
                </motion.div>
              ))}

            {/* Waiting animation */}
            {playerCount < 2 && (
              <motion.p
                className="text-xs text-cyan-500/40 pt-2"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                Esperando mas jugadores... (minimo 2)
              </motion.p>
            )}
          </div>

          {/* Start button (host only) */}
          {isHost && playerCount >= 2 && (
            <motion.button
              onClick={handleStartGame}
              disabled={starting}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-lg shadow-xl shadow-cyan-500/20 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {starting ? 'Iniciando...' : 'Iniciar Partida'}
            </motion.button>
          )}

          {!isHost && playerCount >= 2 && (
            <motion.p
              className="text-sm text-cyan-500/50"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              Esperando a que el host inicie la partida...
            </motion.p>
          )}
        </motion.div>
      </div>
    );
  }

  // ─── Game Over Check ───
  if (store.game?.status === 'finished') {
    const winner = store.players.find((p) => !p.is_bankrupt);
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            GAME OVER
          </h1>
          {winner && (
            <p className="text-xl text-cyan-300">
              Jugador {winner.turn_order + 1} gana con ${winner.balance}
            </p>
          )}
          <a
            href="/"
            className="inline-block mt-4 px-6 py-3 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-500"
          >
            Volver al Lobby
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex h-screen">
        {/* Left Panel — Players */}
        <div className="w-80 p-4 border-r border-cyan-900/20 overflow-y-auto bg-slate-950/80 backdrop-blur">
          <PlayerPanel />
        </div>

        {/* Center — Board + Dice + Actions */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4 overflow-auto">
          <GameBoard />

          <div className="flex flex-col items-center gap-2">
            <DiceRoller onRoll={handleRoll} />
            <ActionBar
              onBuy={handleBuy}
              onEndTurn={handleEndTurn}
              onUsePower={handleUsePower}
            />
          </div>
        </div>

        {/* Right Panel — Game Log + Chat + Emotes */}
        <div className="w-80 p-4 border-l border-cyan-900/20 bg-slate-950/80 backdrop-blur overflow-y-auto flex flex-col gap-4">
          <GameLog />
          <ChatPanel gameId={gameId} />
          <EmotePanel gameId={gameId} />
        </div>
      </div>

      {/* Floating emote bubbles */}
      <EmoteBubble />

      {/* Floating Property Card */}
      <PropertyCard />
    </div>
  );
}

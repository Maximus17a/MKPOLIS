'use client';

import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { getEventById } from '@/lib/game/events-data';
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
import MyPropertiesPanel from '@/components/MyPropertiesPanel';
import EventCardModal from '@/components/EventCardModal';
import BossChoiceModal from '@/components/BossChoiceModal';
import DebtModal from '@/components/DebtModal';
import TradePanel from '@/components/TradePanel';
import TradeOfferModal from '@/components/TradeOfferModal';
import RentModal from '@/components/RentModal';
import { PLAYER_PIECES } from '@/data/board';

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export default function GamePage() {
  const params = useParams();
  const gameId = params.id as string;
  const router = useRouter();
  const store = useGameStore();
  const endingTurnRef = useRef(false);

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
  const [beginRolling, setBeginRolling] = useState(false);
  const [isPreRolling, setIsPreRolling] = useState(false);

  // Auto-close spectator event after 6s (spectators have no action to take)
  useEffect(() => {
    if (!store.spectatorEvent) return;
    const t = setTimeout(() => store.setSpectatorEvent(null), 6000);
    return () => clearTimeout(t);
  }, [store.spectatorEvent]); // eslint-disable-line react-hooks/exhaustive-deps
  const [bossChoice, setBossChoice] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const handleStartGame = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, hostUserId: store.myUserId }),
      });
      if (res.ok) {
        // Fallback poll in case realtime WebSocket is not delivering the update
        const poll = setInterval(async () => {
          const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
          if (game && game.status === 'in_progress') {
            store.setGame(game);
            clearInterval(poll);
          }
        }, 1000);
        setTimeout(() => clearInterval(poll), 10000);
      } else {
        const data = await res.json();
        // If already started, fetch current state and update store (realtime may have missed it)
        if (data.error === 'Game already started') {
          const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();
          if (game) store.setGame(game);
        } else {
          console.error('Start failed:', data.error);
        }
      }
    } catch (err) {
      console.error('Start failed:', err);
    } finally {
      setStarting(false);
    }
  }, [gameId, store, starting, supabase]);

  const handleBeginRoll = useCallback(async () => {
    if (beginRolling) return;
    setBeginRolling(true);
    try {
      await fetch('/api/game/begin-roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, hostUserId: store.myUserId }),
      });
    } catch (err) {
      console.error('begin-roll failed:', err);
    } finally {
      setBeginRolling(false);
    }
  }, [gameId, store.myUserId, beginRolling]);

  const handlePreRoll = useCallback(async () => {
    if (isPreRolling) return;
    const myPlayer = store.players.find((p) => p.id === store.myPlayerId);
    if (!myPlayer) return;
    setIsPreRolling(true);
    try {
      await fetch('/api/game/pre-roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId: myPlayer.id }),
      });
    } catch (err) {
      console.error('pre-roll failed:', err);
    } finally {
      setIsPreRolling(false);
    }
  }, [gameId, store.myPlayerId, store.players, isPreRolling]);

  const handleSelectPiece = useCallback(async (pieceId: string) => {
    const myPlayer = store.players.find((p) => p.id === store.myPlayerId);
    if (!myPlayer) return;
    try {
      await fetch('/api/game/select-piece', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId: myPlayer.id, piece: pieceId }),
      });
    } catch (err) {
      console.error('select-piece failed:', err);
    }
  }, [gameId, store.myPlayerId, store.players]);

  // ─── API Call Wrappers with Optimistic Updates ───

  const handleRoll = useCallback(async () => {
    const player = store.myPlayer();
    if (!player) return;

    // If skull_king quest is active and no prediction made yet, show the prediction modal
    if (player.active_quest_id === 'quest_skull_king' && !store.dicePrediction) {
      const skullEvent = getEventById('quest_skull_king');
      if (skullEvent) store.setActiveEvent(skullEvent);
      return;
    }

    try {
      const res = await fetch('/api/game/roll-dice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          playerId: player.id,
          doublesCount: store.doublesCount,
          dicePrediction: store.dicePrediction,
        }),
      });

      if (res.status === 409) {
        store.rollbackToSnapshot();
        return;
      }

      const data = await res.json();
      if (data.dice) {
        store.setDiceResult(data.dice);
      }
      // Update turn_phase locally so dice button disables immediately (no wait for realtime)
      // Skip for stunned/jail cases — the server already advanced the turn to the next player,
      // so updating locally to 'action' would wrongly trigger the auto-end-turn timer.
      if (store.game && !data.stunned && !data.inJail && !data.jailPaid) {
        store.setGame({ ...store.game, turn_phase: data.isDoubles ? 'roll' : 'action' });
      }
      // Track doubles count for re-roll logic
      store.setDoublesCount(data.doublesCount ?? 0);
      // Show event card modal (quest or boss fight)
      if (data.event) {
        store.setActiveEvent(data.event);
      }
      // Check if boss requires player choice
      if (data.landingEffect?.startsWith('BOSS_CHOICE:')) {
        setBossChoice(true);
      }
      // Check if rent is owed
      if (data.rentOwed) {
        store.setPendingRent({
          amount: data.rentOwed.amount,
          ownerId: data.rentOwed.ownerId,
          tileName: data.rentOwed.tileName,
        });
      }
      // Clear prediction after roll
      store.setDicePrediction(null);
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
    if (endingTurnRef.current) return;
    const player = store.myPlayer();
    if (!player) return;

    endingTurnRef.current = true;
    // Optimistically set turn_phase to 'roll' so canEndTurn becomes false immediately
    if (store.game) store.setGame({ ...store.game, turn_phase: 'roll' });

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
    } finally {
      endingTurnRef.current = false;
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

  const handleUpgrade = useCallback(
    async (propertyIndex: number) => {
      const player = store.myPlayer();
      if (!player) return;

      try {
        const res = await fetch('/api/game/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, playerId: player.id, propertyIndex }),
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

  // ─── Waiting Lobby + Pre-Roll ───
  const isHost = store.game?.host_id === store.myUserId;
  const playerCount = store.players.length;
  const myLobbyPlayer = store.players.find((p) => p.id === store.myPlayerId);
  const isPreRollPhase = store.game?.status === 'pre_roll';
  const allRolled = playerCount >= 2 && store.players.every((p) => p.pre_roll_result != null);
  const myPlayerRolled = myLobbyPlayer?.pre_roll_result != null;

  if (store.game?.status === 'waiting' || store.game?.status === 'pre_roll') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          className="relative z-10 text-center space-y-6 max-w-lg w-full mx-auto px-4 py-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-2">
              MKpolis
            </h1>
            <p className="text-cyan-500/50 text-sm">
              {isPreRollPhase ? '¡Tirad los dados para el orden de turno!' : 'Sala de espera'}
            </p>
          </div>

          {/* Game ID (waiting only) */}
          {!isPreRollPhase && (
            <div className="p-4 rounded-xl border border-cyan-900/30 bg-slate-900/60">
              <p className="text-xs text-cyan-500/50 mb-1">Codigo de partida</p>
              <p className="text-lg font-mono text-cyan-300 select-all">{gameId}</p>
              <p className="text-xs text-cyan-500/30 mt-2">Comparte este codigo para que otros se unan</p>
            </div>
          )}

          {/* Piece Selection (waiting only) */}
          {!isPreRollPhase && (
            <div className="space-y-3">
              <p className="text-xs text-cyan-500/60 uppercase tracking-widest">Elige tu ficha</p>
              <div className="grid grid-cols-5 gap-2">
                {PLAYER_PIECES.map((piece) => {
                  const takerPlayer = store.players.find(
                    (p) => p.piece === piece.id && p.id !== store.myPlayerId
                  );
                  const isTaken = takerPlayer != null;
                  const isSelected = myLobbyPlayer?.piece === piece.id;
                  return (
                    <button
                      key={piece.id}
                      onClick={() => !isTaken && handleSelectPiece(piece.id)}
                      disabled={isTaken}
                      className={[
                        'p-2 rounded-lg border flex flex-col items-center gap-0.5 transition-all',
                        isSelected
                          ? 'border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/20'
                          : isTaken
                          ? 'border-slate-700/40 bg-slate-900/20 opacity-40 cursor-not-allowed'
                          : 'border-cyan-900/30 bg-slate-900/40 hover:border-cyan-500/40 hover:bg-slate-800/40 cursor-pointer',
                      ].join(' ')}
                    >
                      <span className="text-xl leading-none">{piece.emoji}</span>
                      <span className="text-[9px] text-cyan-400/70 leading-tight">{piece.name}</span>
                      {isTaken && takerPlayer && (
                        <div
                          className="w-1.5 h-1.5 rounded-full mt-0.5"
                          style={{ background: takerPlayer.color }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Players list */}
          <div className="space-y-2">
            <p className="text-xs text-cyan-500/60 uppercase tracking-widest">
              {isPreRollPhase ? `Resultados (${store.players.filter((p) => p.pre_roll_result != null).length}/${playerCount})` : `Jugadores (${playerCount}/6)`}
            </p>
            {store.players
              .slice()
              .sort((a, b) => {
                if (isPreRollPhase && allRolled) {
                  return (b.pre_roll_result ?? 0) - (a.pre_roll_result ?? 0);
                }
                return a.turn_order - b.turn_order;
              })
              .map((p) => {
                const piece = PLAYER_PIECES.find((x) => x.id === p.piece);
                const isMe = p.id === store.myPlayerId;
                const hasRolled = p.pre_roll_result != null;
                return (
                  <motion.div
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-cyan-900/20 bg-slate-900/40"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-lg border"
                      style={{ background: p.color + '28', borderColor: p.color + '60' }}
                    >
                      {piece ? (
                        piece.emoji
                      ) : (
                        <span className="text-xs font-black" style={{ color: p.color }}>
                          P{p.turn_order + 1}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-cyan-200 flex-1 text-left">{store.getPlayerName(p)}</span>

                    {/* Pre-roll die result */}
                    {isPreRollPhase && (
                      <span className="text-2xl leading-none w-8 text-center">
                        {hasRolled ? DICE_FACES[p.pre_roll_result!] : '⬜'}
                      </span>
                    )}

                    {/* Roll button for current player */}
                    {isPreRollPhase && isMe && !hasRolled && (
                      <motion.button
                        onClick={handlePreRoll}
                        disabled={isPreRolling}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xs font-bold disabled:opacity-50 hover:from-cyan-400 hover:to-purple-500"
                        whileTap={{ scale: 0.95 }}
                      >
                        {isPreRolling ? '...' : '🎲 Lanzar'}
                      </motion.button>
                    )}

                    {p.user_id === store.game?.host_id && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                        HOST
                      </span>
                    )}
                  </motion.div>
                );
              })}

            {!isPreRollPhase && playerCount < 2 && (
              <motion.p
                className="text-xs text-cyan-500/40 pt-2"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                Esperando mas jugadores... (minimo 2)
              </motion.p>
            )}
          </div>

          {/* Action buttons */}
          {!isPreRollPhase && isHost && playerCount >= 2 && (
            <motion.button
              onClick={handleBeginRoll}
              disabled={beginRolling}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-lg shadow-xl shadow-cyan-500/20 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {beginRolling ? '...' : '🎲 Tirar para el orden'}
            </motion.button>
          )}

          {!isPreRollPhase && !isHost && playerCount >= 2 && (
            <motion.p
              className="text-sm text-cyan-500/50"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              Esperando a que el host inicie la partida...
            </motion.p>
          )}

          {isPreRollPhase && isHost && allRolled && (
            <motion.button
              onClick={handleStartGame}
              disabled={starting}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-cyan-600 text-white font-bold text-lg shadow-xl shadow-green-500/20 hover:from-green-400 hover:to-cyan-500 disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {starting ? 'Iniciando...' : '🚀 Iniciar Partida'}
            </motion.button>
          )}

          {isPreRollPhase && (isHost ? !allRolled : true) && (
            <motion.p
              className="text-sm text-cyan-500/50"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {allRolled && !isHost
                ? 'Esperando que el host inicie...'
                : !myPlayerRolled
                ? 'Lanza tu dado para el orden de turno'
                : 'Esperando a que todos lancen...'}
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
          <button
            onClick={() => router.push('/')}
            className="inline-block mt-4 px-6 py-3 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-500"
          >
            Volver al Lobby
          </button>
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
          <MyPropertiesPanel gameId={gameId} onUpgrade={handleUpgrade} />
          <TradePanel gameId={gameId} />
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

      {/* Event Card Modal (quest / boss fight) — active player */}
      <EventCardModal
        event={store.activeEvent}
        onClose={() => store.setActiveEvent(null)}
        onPredict={(pred) => {
          store.setDicePrediction(pred);
          store.setActiveEvent(null);
        }}
      />

      {/* Event Card Modal — spectator view for other players */}
      {(() => {
        const currentPlayer = store.currentPlayer();
        const spectatorName = currentPlayer ? store.getPlayerName(currentPlayer) : undefined;
        return (
          <EventCardModal
            event={store.spectatorEvent}
            onClose={() => store.setSpectatorEvent(null)}
            spectator
            playerName={spectatorName}
          />
        );
      })()}

      {/* Boss choice modal (e.g., botlane duo) */}
      {bossChoice && store.myPlayerId && (
        <BossChoiceModal
          gameId={gameId}
          playerId={store.myPlayerId}
          onClose={() => setBossChoice(false)}
        />
      )}

      {/* Rent payment modal */}
      <RentModal gameId={gameId} />

      {/* Debt modal (negative balance) */}
      <DebtModal gameId={gameId} />

      {/* Trade offer modal (incoming offers) */}
      <TradeOfferModal />

      {/* Floating Property Card */}
      <PropertyCard />
    </div>
  );
}

'use client';

import { useEffect, useCallback } from 'react';
import { useGameStore } from '@/store/useGameStore';
import GameBoard from '@/components/GameBoard';
import DiceRoller from '@/components/DiceRoller';
import PlayerPanel from '@/components/PlayerPanel';
import PropertyCard from '@/components/PropertyCard';
import GameLog from '@/components/GameLog';
import ActionBar from '@/components/ActionBar';
import ChatPanel from '@/components/ChatPanel';
import EmotePanel from '@/components/EmotePanel';
import type { Game, Player, Property, GameLog as GameLogType } from '@/lib/database.types';

// Mock data for demo preview
const MOCK_GAME: Game = {
  id: 'demo-game',
  host_id: 'user-1',
  status: 'in_progress',
  current_turn_player_id: 'player-1',
  turn_phase: 'roll',
  version: 1,
  created_at: new Date().toISOString(),
};

const MOCK_PLAYERS: Player[] = [
  { id: 'player-1', game_id: 'demo-game', user_id: 'user-1', position_index: 0, balance: 1500, is_bankrupt: false, jail_turns_remaining: 0, stun_turns_remaining: 0, turn_order: 0, color: '#00ffcc', version: 1 },
  { id: 'player-2', game_id: 'demo-game', user_id: 'user-2', position_index: 5, balance: 1320, is_bankrupt: false, jail_turns_remaining: 0, stun_turns_remaining: 0, turn_order: 1, color: '#ff3d71', version: 1 },
  { id: 'player-3', game_id: 'demo-game', user_id: 'user-3', position_index: 12, balance: 980, is_bankrupt: false, jail_turns_remaining: 2, stun_turns_remaining: 0, turn_order: 2, color: '#ffaa00', version: 1 },
  { id: 'player-4', game_id: 'demo-game', user_id: 'user-4', position_index: 24, balance: 1750, is_bankrupt: false, jail_turns_remaining: 0, stun_turns_remaining: 1, turn_order: 3, color: '#7c4dff', version: 1 },
];

const MOCK_PROPERTIES: Property[] = [
  { id: 'prop-1', game_id: 'demo-game', property_index: 1, owner_id: 'player-1', server_level: 1, is_mortgaged: false, version: 1 },
  { id: 'prop-3', game_id: 'demo-game', property_index: 3, owner_id: 'player-1', server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-6', game_id: 'demo-game', property_index: 6, owner_id: 'player-2', server_level: 2, is_mortgaged: false, version: 1 },
  { id: 'prop-8', game_id: 'demo-game', property_index: 8, owner_id: 'player-2', server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-11', game_id: 'demo-game', property_index: 11, owner_id: 'player-3', server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-21', game_id: 'demo-game', property_index: 21, owner_id: 'player-4', server_level: 1, is_mortgaged: false, version: 1 },
  { id: 'prop-24', game_id: 'demo-game', property_index: 24, owner_id: 'player-4', server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-5', game_id: 'demo-game', property_index: 5, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-9', game_id: 'demo-game', property_index: 9, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-13', game_id: 'demo-game', property_index: 13, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-14', game_id: 'demo-game', property_index: 14, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-15', game_id: 'demo-game', property_index: 15, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-16', game_id: 'demo-game', property_index: 16, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-18', game_id: 'demo-game', property_index: 18, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-19', game_id: 'demo-game', property_index: 19, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-23', game_id: 'demo-game', property_index: 23, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-25', game_id: 'demo-game', property_index: 25, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-26', game_id: 'demo-game', property_index: 26, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-27', game_id: 'demo-game', property_index: 27, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-28', game_id: 'demo-game', property_index: 28, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-29', game_id: 'demo-game', property_index: 29, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-31', game_id: 'demo-game', property_index: 31, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-32', game_id: 'demo-game', property_index: 32, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-34', game_id: 'demo-game', property_index: 34, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-35', game_id: 'demo-game', property_index: 35, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-37', game_id: 'demo-game', property_index: 37, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-39', game_id: 'demo-game', property_index: 39, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
  { id: 'prop-12', game_id: 'demo-game', property_index: 12, owner_id: null, server_level: 0, is_mortgaged: false, version: 1 },
];

const MOCK_LOGS: GameLogType[] = [
  { id: 'log-1', game_id: 'demo-game', player_id: 'player-1', message: 'La partida ha comenzado!', action_type: 'start', created_at: new Date(Date.now() - 300000).toISOString() },
  { id: 'log-2', game_id: 'demo-game', player_id: 'player-1', message: 'Tiró 3+4=7. Avanza a Misión Secundaria.', action_type: 'roll', created_at: new Date(Date.now() - 240000).toISOString() },
  { id: 'log-3', game_id: 'demo-game', player_id: 'player-2', message: 'Compró Fortnite por 100 monedas.', action_type: 'buy', created_at: new Date(Date.now() - 180000).toISOString() },
  { id: 'log-4', game_id: 'demo-game', player_id: 'player-3', message: 'Enviado al LAG!', action_type: 'jail', created_at: new Date(Date.now() - 120000).toISOString() },
  { id: 'log-5', game_id: 'demo-game', player_id: 'player-4', message: 'Usó Stun sobre Jugador 1. 1 turno paralizado!', action_type: 'power_card', created_at: new Date(Date.now() - 60000).toISOString() },
  { id: 'log-6', game_id: 'demo-game', player_id: 'player-1', message: 'Esperando turno...', action_type: 'end_turn', created_at: new Date().toISOString() },
];

export default function DemoPage() {
  const store = useGameStore();

  useEffect(() => {
    store.setGame(MOCK_GAME);
    store.setPlayers(MOCK_PLAYERS);
    store.setProperties(MOCK_PROPERTIES);
    store.setLogs(MOCK_LOGS);
    store.setMyPlayerId('player-1');
    store.setMyUserId('user-1');
    store.setDiceResult([3, 4]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRoll = useCallback(async () => {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    store.setDiceResult([d1, d2]);

    // Demo: move player
    const player = store.myPlayer();
    if (player) {
      const newPos = (player.position_index + d1 + d2) % 40;
      store.optimisticMovePlayer(player.id, newPos, player.balance);
      store.addLog({
        id: `log-${Date.now()}`,
        game_id: 'demo-game',
        player_id: player.id,
        message: `Tiró ${d1}+${d2}=${d1 + d2}. Avanza a casilla ${newPos}.`,
        action_type: 'roll',
        created_at: new Date().toISOString(),
      });
      // Set phase to action
      if (store.game) {
        store.setGame({ ...store.game, turn_phase: 'action' });
      }
    }
  }, [store]);

  const handleBuy = useCallback(async () => {
    // Demo no-op
  }, []);

  const handleEndTurn = useCallback(async () => {
    if (!store.game) return;
    const activePlayers = store.players.filter((p) => !p.is_bankrupt);
    const currentIdx = activePlayers.findIndex((p) => p.id === store.game?.current_turn_player_id);
    const nextIdx = (currentIdx + 1) % activePlayers.length;
    store.setGame({
      ...store.game,
      current_turn_player_id: activePlayers[nextIdx].id,
      turn_phase: 'roll',
    });
  }, [store]);

  const handleUsePower = useCallback(async () => {
    // Demo no-op
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Demo banner */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 px-4 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs">
        DEMO MODE — Vista previa del tablero
      </div>

      <div className="relative z-10 flex h-screen">
        {/* Left Panel */}
        <div className="w-80 p-4 border-r border-cyan-900/20 overflow-y-auto bg-slate-950/80 backdrop-blur">
          <PlayerPanel />
        </div>

        {/* Center */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4 overflow-auto">
          <GameBoard />
          <div className="flex flex-col items-center gap-2">
            <DiceRoller onRoll={handleRoll} />
            <ActionBar onBuy={handleBuy} onEndTurn={handleEndTurn} onUsePower={handleUsePower} />
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 p-4 border-l border-cyan-900/20 bg-slate-950/80 backdrop-blur overflow-y-auto flex flex-col gap-4">
          <GameLog />
          <ChatPanel gameId="demo-game" />
          <EmotePanel gameId="demo-game" />
        </div>
      </div>

      <PropertyCard />
    </div>
  );
}

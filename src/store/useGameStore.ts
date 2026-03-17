'use client';

import { create } from 'zustand';
import type { Game, Player, Property, PlayerCard, GameLog, Profile } from '@/lib/database.types';

// Snapshot for OCC rollback
interface GameSnapshot {
  game: Game | null;
  players: Player[];
  properties: Property[];
}

interface GameState {
  // Core state
  game: Game | null;
  players: Player[];
  properties: Property[];
  cards: PlayerCard[];
  logs: GameLog[];
  profiles: Record<string, Profile>; // keyed by user_id
  myPlayerId: string | null;
  myUserId: string | null;

  // OCC
  _snapshot: GameSnapshot | null;
  _optimisticPending: boolean;

  // UI state
  diceResult: [number, number] | null;
  isRolling: boolean;
  doublesCount: number;
  showPropertyCard: number | null; // property_index or null
  chatOpen: boolean;

  // Actions — State setters (called by Realtime subscription as source of truth)
  setGame: (game: Game) => void;
  setPlayers: (players: Player[]) => void;
  updatePlayer: (player: Player) => void;
  setProperties: (properties: Property[]) => void;
  updateProperty: (property: Property) => void;
  setCards: (cards: PlayerCard[]) => void;
  addLog: (log: GameLog) => void;
  setLogs: (logs: GameLog[]) => void;
  setProfiles: (profiles: Profile[]) => void;
  setMyPlayerId: (id: string | null) => void;
  setMyUserId: (id: string | null) => void;

  // Optimistic UI
  optimisticMovePlayer: (playerId: string, newPosition: number, newBalance: number) => void;
  optimisticBuyProperty: (propertyIndex: number, playerId: string, cost: number) => void;
  rollbackToSnapshot: () => void;
  clearOptimistic: () => void;

  // UI Actions
  setDiceResult: (result: [number, number] | null) => void;
  setIsRolling: (rolling: boolean) => void;
  setDoublesCount: (count: number) => void;
  setShowPropertyCard: (index: number | null) => void;
  toggleChat: () => void;

  // Derived
  currentPlayer: () => Player | undefined;
  myPlayer: () => Player | undefined;
  isMyTurn: () => boolean;
  getPropertyOwner: (propertyIndex: number) => Player | undefined;
  getPlayerName: (player: Player) => string;
}

export const useGameStore = create<GameState>((set, get) => ({
  game: null,
  players: [],
  properties: [],
  cards: [],
  logs: [],
  profiles: {},
  myPlayerId: null,
  myUserId: null,
  _snapshot: null,
  _optimisticPending: false,
  diceResult: null,
  isRolling: false,
  doublesCount: 0,
  showPropertyCard: null,
  chatOpen: false,

  // ─── Realtime setters (source of truth) ───
  setGame: (game) => set({ game }),
  setPlayers: (players) => set({ players }),
  updatePlayer: (updated) =>
    set((s) => ({
      players: s.players.map((p) => (p.id === updated.id ? updated : p)),
    })),
  setProperties: (properties) => set({ properties }),
  updateProperty: (updated) =>
    set((s) => ({
      properties: s.properties.map((p) => (p.id === updated.id ? updated : p)),
    })),
  setProfiles: (profileList) => {
    const map: Record<string, Profile> = {};
    for (const p of profileList) map[p.id] = p;
    set({ profiles: map });
  },
  setCards: (cards) => set({ cards }),
  addLog: (log) => set((s) => ({ logs: [...s.logs.slice(-99), log] })),
  setLogs: (logs) => set({ logs }),
  setMyPlayerId: (id) => set({ myPlayerId: id }),
  setMyUserId: (id) => set({ myUserId: id }),

  // ─── Optimistic Updates ───
  optimisticMovePlayer: (playerId, newPosition, newBalance) => {
    const state = get();
    // Save snapshot before optimistic update
    set({
      _snapshot: {
        game: state.game,
        players: [...state.players],
        properties: [...state.properties],
      },
      _optimisticPending: true,
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, position_index: newPosition, balance: newBalance } : p
      ),
    });
  },

  optimisticBuyProperty: (propertyIndex, playerId, cost) => {
    const state = get();
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;

    set({
      _snapshot: {
        game: state.game,
        players: [...state.players],
        properties: [...state.properties],
      },
      _optimisticPending: true,
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, balance: p.balance - cost } : p
      ),
      properties: state.properties.map((prop) =>
        prop.property_index === propertyIndex ? { ...prop, owner_id: playerId } : prop
      ),
    });
  },

  rollbackToSnapshot: () => {
    const snap = get()._snapshot;
    if (!snap) return;
    set({
      game: snap.game,
      players: snap.players,
      properties: snap.properties,
      _snapshot: null,
      _optimisticPending: false,
    });
  },

  clearOptimistic: () => set({ _snapshot: null, _optimisticPending: false }),

  // ─── UI ───
  setDiceResult: (result) => set({ diceResult: result }),
  setIsRolling: (rolling) => set({ isRolling: rolling }),
  setDoublesCount: (count) => set({ doublesCount: count }),
  setShowPropertyCard: (index) => set({ showPropertyCard: index }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),

  // ─── Derived ───
  currentPlayer: () => {
    const { game, players } = get();
    return players.find((p) => p.id === game?.current_turn_player_id);
  },
  myPlayer: () => {
    const { players, myPlayerId } = get();
    return players.find((p) => p.id === myPlayerId);
  },
  isMyTurn: () => {
    const { game, myPlayerId } = get();
    return game?.current_turn_player_id === myPlayerId;
  },
  getPropertyOwner: (propertyIndex) => {
    const { properties, players } = get();
    const prop = properties.find((p) => p.property_index === propertyIndex);
    if (!prop?.owner_id) return undefined;
    return players.find((p) => p.id === prop.owner_id);
  },
  getPlayerName: (player) => {
    const { profiles, myUserId } = get();
    if (player.user_id === myUserId) return 'Tu';
    const profile = profiles[player.user_id];
    return profile?.username ?? `Jugador ${player.turn_order + 1}`;
  },
}));

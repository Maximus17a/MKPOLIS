'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { BOARD_TILES, isPropertyTile } from '@/data/board';

interface ActionBarProps {
  onBuy: () => Promise<void>;
  onEndTurn: () => Promise<void>;
  onUsePower: (cardId: string, targetPlayerId?: string) => Promise<void>;
}

export default function ActionBar({ onBuy, onEndTurn, onUsePower }: ActionBarProps) {
  const { game, myPlayer, isMyTurn, properties, cards, myPlayerId, players, getPlayerName } = useGameStore();

  const player = myPlayer();
  if (!player || !game) return null;

  const currentTile = BOARD_TILES[player.position_index];
  const prop = properties.find((p) => p.property_index === player.position_index);
  const canBuy =
    isMyTurn() &&
    game.turn_phase === 'action' &&
    isPropertyTile(currentTile) &&
    prop &&
    !prop.owner_id &&
    currentTile.price &&
    player.balance >= currentTile.price;

  const canEndTurn = isMyTurn() && game.turn_phase === 'action';

  const myCards = cards.filter((c) => c.player_id === myPlayerId && !c.is_used);

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {/* Buy button */}
      {canBuy && (
        <motion.button
          onClick={onBuy}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-700 text-white text-xs font-bold uppercase tracking-wider hover:from-green-500 hover:to-emerald-600 shadow-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Comprar {currentTile.name} (${currentTile.price})
        </motion.button>
      )}

      {/* Power cards */}
      {myCards.map((card) => {
        const cardNames: Record<string, string> = {
          stun: '⚡ Stun',
          respawn: '🔄 Respawn',
          loot_drop: '💰 Loot',
          gankeo: '🗡️ Gankeo',
        };

        const needsTarget = card.card_type === 'stun' || card.card_type === 'gankeo';
        const targets = needsTarget
          ? players.filter((p) => p.id !== myPlayerId && !p.is_bankrupt)
          : [];

        return (
          <div key={card.id} className="relative group">
            <motion.button
              className="px-3 py-2 rounded-lg bg-purple-900/60 border border-purple-500/30 text-purple-300 text-xs font-bold hover:bg-purple-800/60"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (!needsTarget) {
                  onUsePower(card.id);
                }
              }}
            >
              {cardNames[card.card_type] ?? card.card_type}
            </motion.button>

            {/* Target dropdown for stun/gankeo */}
            {needsTarget && targets.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-slate-900 border border-cyan-900/30 rounded-lg overflow-hidden z-20">
                {targets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onUsePower(card.id, t.id)}
                    className="block w-full text-left px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-900/30"
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1"
                      style={{ background: t.color }}
                    />
                    {getPlayerName(t)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* End Turn */}
      {canEndTurn && (
        <motion.button
          onClick={onEndTurn}
          className="px-4 py-2 rounded-lg bg-slate-800/80 border border-cyan-900/30 text-cyan-400/80 text-xs font-bold uppercase tracking-wider hover:bg-slate-700/80"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Terminar Turno
        </motion.button>
      )}

      {/* Status */}
      {!isMyTurn() && (
        <div className="text-xs text-cyan-500/40 animate-pulse">
          Esperando turno de otro jugador...
        </div>
      )}
    </div>
  );
}

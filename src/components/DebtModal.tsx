'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { BOARD_TILES } from '@/data/board';

interface DebtModalProps {
  gameId: string;
}

export default function DebtModal({ gameId }: DebtModalProps) {
  const { myPlayerId, players, properties, game } = useGameStore();
  const [declaring, setDeclaring] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const player = players.find((p) => p.id === myPlayerId);
  if (!player || !game) return null;

  const isMyTurn = game.current_turn_player_id === myPlayerId;

  // Re-show modal if balance is still negative after 3 seconds
  const prevBalance = useRef(player.balance);
  useEffect(() => {
    if (player.balance !== prevBalance.current) {
      prevBalance.current = player.balance;
      if (player.balance < 0 && dismissed) {
        const timer = setTimeout(() => setDismissed(false), 3000);
        return () => clearTimeout(timer);
      }
      if (player.balance >= 0) setDismissed(false);
    }
  }, [player.balance, dismissed]);

  // Check if player balance is negative (owes money)
  if (player.balance >= 0 || !isMyTurn) return null;
  // Allow temporary dismiss so player can mortgage/sell
  if (dismissed) return null;

  const debt = Math.abs(player.balance);

  // Calculate total net worth: balance + 50% property values + improvement refunds
  const myProps = properties.filter((p) => p.owner_id === myPlayerId);
  const totalAssetValue = myProps.reduce((sum, prop) => {
    const tile = BOARD_TILES[prop.property_index];
    if (!tile) return sum;
    const propVal = prop.is_mortgaged ? 0 : Math.floor((tile.price ?? 0) / 2);
    const improvementVal = (tile.buildCost ?? 0) * prop.server_level * 0.5;
    return sum + propVal + improvementVal;
  }, 0);

  const canPayWithAssets = totalAssetValue > 0;
  const netWorth = player.balance + totalAssetValue;
  const mustBankrupt = netWorth < 0 && !canPayWithAssets;

  const handleBankrupt = async () => {
    if (declaring) return;
    setDeclaring(true);
    try {
      // Determine creditor: look at who owns the tile player is on
      const prop = properties.find((p) => p.property_index === player.position_index);
      const creditorId = prop?.owner_id && prop.owner_id !== myPlayerId ? prop.owner_id : null;

      await fetch('/api/game/bankrupt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId: myPlayerId, creditorId }),
      });
    } finally {
      setDeclaring(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-80 rounded-2xl border border-red-500/40 bg-slate-950 overflow-hidden shadow-2xl"
          style={{ boxShadow: '0 0 60px #ff000022' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-red-900/60 to-orange-900/40 px-5 py-4 text-center">
            <div className="text-3xl mb-1">⚠️</div>
            <h2 className="text-lg font-black text-red-300">Deuda Pendiente</h2>
            <p className="text-2xl font-mono font-black text-red-400 mt-1">-${debt}</p>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-xs text-cyan-100/70 leading-relaxed text-center">
              Tu saldo es negativo. Debes cubrir tu deuda antes de continuar.
              Vende mejoras, hipoteca propiedades o negocia para obtener fondos.
            </p>

            {/* Status */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between text-cyan-400/60">
                <span>Saldo actual:</span>
                <span className="text-red-400 font-mono">${player.balance}</span>
              </div>
              <div className="flex justify-between text-cyan-400/60">
                <span>Valor de activos:</span>
                <span className="text-yellow-400 font-mono">${Math.floor(totalAssetValue)}</span>
              </div>
              <div className="flex justify-between text-cyan-400/60 border-t border-cyan-900/20 pt-1">
                <span>Patrimonio neto:</span>
                <span className={`font-mono font-bold ${netWorth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${Math.floor(netWorth)}
                </span>
              </div>
            </div>

            {canPayWithAssets && (
              <motion.button
                onClick={() => setDismissed(true)}
                className="w-full py-2.5 rounded-xl bg-yellow-900/30 border border-yellow-500/30 text-yellow-300 font-bold text-sm hover:bg-yellow-800/30"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                🏦 Ir a Mis Propiedades (hipotecar/vender)
              </motion.button>
            )}

            {/* Bankrupt button */}
            {mustBankrupt && (
              <motion.button
                onClick={handleBankrupt}
                disabled={declaring}
                className="w-full py-3 rounded-xl bg-red-900/60 border border-red-500/40 text-red-300 font-bold text-sm hover:bg-red-800/60 disabled:opacity-40"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {declaring ? 'Declarando...' : '💀 Declarar Bancarrota'}
              </motion.button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

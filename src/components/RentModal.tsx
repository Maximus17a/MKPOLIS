'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { BOARD_TILES } from '@/data/board';

interface RentModalProps {
  gameId: string;
}

export default function RentModal({ gameId }: RentModalProps) {
  const { pendingRent, setPendingRent, myPlayerId, players, properties, getPlayerName } = useGameStore();
  const [paying, setPaying] = useState(false);
  const [declaring, setDeclaring] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Re-show when balance changes (player sold/mortgaged something)
  const prevBalance = useRef<number | null>(null);
  const player0 = players.find((p) => p.id === myPlayerId);
  useEffect(() => {
    if (player0 && prevBalance.current !== null && player0.balance !== prevBalance.current) {
      setMinimized(false);
    }
    if (player0) prevBalance.current = player0.balance;
  }, [player0?.balance]);

  if (!pendingRent || !myPlayerId) return null;

  const player = players.find((p) => p.id === myPlayerId);
  const owner = players.find((p) => p.id === pendingRent.ownerId);
  if (!player) return null;

  const canPay = player.balance >= pendingRent.amount;

  // Show minimized floating reminder instead of blocking modal
  if (minimized) {
    return (
      <motion.button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-40 px-4 py-3 rounded-xl bg-yellow-900/80 border border-yellow-500/40 text-yellow-300 text-xs font-bold shadow-lg backdrop-blur-sm"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        🏠 Renta pendiente: ${pendingRent.amount} — Click para pagar
      </motion.button>
    );
  }

  // Calculate net worth to determine if bankruptcy is the only option
  const myProps = properties.filter((p) => p.owner_id === myPlayerId);
  const totalAssetValue = myProps.reduce((sum, prop) => {
    const tile = BOARD_TILES[prop.property_index];
    if (!tile) return sum;
    const propVal = prop.is_mortgaged ? 0 : Math.floor((tile.price ?? 0) / 2);
    const improvVal = (tile.buildCost ?? 0) * prop.server_level * 0.5;
    return sum + propVal + improvVal;
  }, 0);

  const netWorth = player.balance + totalAssetValue;
  const canRecover = netWorth >= pendingRent.amount; // can pay if they sell/mortgage
  const mustBankrupt = !canPay && !canRecover;

  const handlePay = async () => {
    if (paying || !canPay) return;
    setPaying(true);
    try {
      const res = await fetch('/api/game/pay-rent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          playerId: myPlayerId,
          rentAmount: pendingRent.amount,
          ownerId: pendingRent.ownerId,
        }),
      });
      if (res.ok) {
        setPendingRent(null);
      }
    } finally {
      setPaying(false);
    }
  };

  const handleBankrupt = async () => {
    if (declaring) return;
    setDeclaring(true);
    try {
      await fetch('/api/game/bankrupt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          playerId: myPlayerId,
          creditorId: pendingRent.ownerId,
        }),
      });
      setPendingRent(null);
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
          className="w-80 rounded-2xl border border-yellow-500/40 bg-slate-950 overflow-hidden shadow-2xl"
          style={{ boxShadow: '0 0 50px #eab30822' }}
          initial={{ scale: 0.8, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-yellow-900/50 to-orange-900/40 px-5 py-4 text-center">
            <div className="text-3xl mb-1">🏠</div>
            <h2 className="text-lg font-black text-yellow-300">Alquiler</h2>
            <p className="text-sm text-cyan-100/60 mt-1">{pendingRent.tileName}</p>
          </div>

          <div className="p-5 space-y-4">
            {/* Rent amount */}
            <div className="text-center">
              <p className="text-xs text-cyan-400/60 mb-1">Debes pagar al propietario</p>
              <p className="text-3xl font-mono font-black text-yellow-400">${pendingRent.amount}</p>
              {owner && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: owner.color }} />
                  <span className="text-xs text-cyan-300">{getPlayerName(owner)}</span>
                </div>
              )}
            </div>

            {/* Balance info */}
            <div className="flex justify-between text-xs border-t border-cyan-900/20 pt-3">
              <span className="text-cyan-400/60">Tu saldo:</span>
              <span className={`font-mono font-bold ${canPay ? 'text-green-400' : 'text-red-400'}`}>
                ${player.balance}
              </span>
            </div>

            {/* Pay button */}
            {canPay ? (
              <motion.button
                onClick={handlePay}
                disabled={paying}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-green-700 to-emerald-800 border border-green-500/30 text-white font-bold text-sm hover:from-green-600 hover:to-emerald-700 disabled:opacity-40 shadow-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {paying ? 'Pagando...' : `💰 Pagar $${pendingRent.amount}`}
              </motion.button>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-red-900/10 border border-red-500/20">
                  <p className="text-xs text-red-300 text-center leading-relaxed">
                    <span className="font-bold">Fondos insuficientes.</span>
                    {canRecover
                      ? ' Hipoteca o vende propiedades en "Mis Propiedades" para obtener fondos.'
                      : ' No puedes cubrir esta deuda.'}
                  </p>
                </div>

                {/* Go manage properties to get funds */}
                {canRecover && (
                  <motion.button
                    onClick={() => setMinimized(true)}
                    className="w-full py-2.5 rounded-xl bg-yellow-900/30 border border-yellow-500/30 text-yellow-300 font-bold text-sm hover:bg-yellow-800/30"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    🏦 Ir a Mis Propiedades (hipotecar/vender)
                  </motion.button>
                )}

                {/* Bankruptcy */}
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
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

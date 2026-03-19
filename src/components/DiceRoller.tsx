'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';

const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]],
};

function DieFace({ value, rolling }: { value: number; rolling: boolean }) {
  const dots = DOT_POSITIONS[value] || [];

  return (
    <motion.div
      className="relative w-20 h-20 rounded-2xl border border-cyan-500/40"
      style={{
        background: 'linear-gradient(145deg, #0d1f3c, #091525)',
        boxShadow: '0 0 24px rgba(0, 255, 204, 0.18), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.3)',
      }}
      animate={
        rolling
          ? { rotateX: [0, 360, 720], rotateY: [0, 360, 720], scale: [1, 1.15, 1] }
          : { rotateX: 0, rotateY: 0, scale: 1 }
      }
      transition={
        rolling
          ? { duration: 0.8, ease: 'easeOut' }
          : { type: 'spring', stiffness: 500, damping: 30 }
      }
    >
      {dots.map(([x, y], i) => (
        <motion.div
          key={i}
          className="absolute w-3.5 h-3.5 rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle at 35% 35%, #00ffcc, #00aa88)',
            boxShadow: '0 0 8px rgba(0, 255, 204, 0.7)',
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: rolling ? 0.8 + i * 0.05 : i * 0.05 }}
        />
      ))}
    </motion.div>
  );
}

interface DiceRollerProps {
  onRoll: () => Promise<void>;
  disabled?: boolean;
}

export default function DiceRoller({ onRoll, disabled }: DiceRollerProps) {
  const { diceResult, isRolling, isMyTurn, game, doublesCount } = useGameStore();
  const isDoubles = diceResult && diceResult[0] === diceResult[1];
  const canRoll = isMyTurn() && game?.turn_phase === 'roll' && !isRolling && !disabled;

  const handleRoll = useCallback(async () => {
    if (!canRoll) return;
    useGameStore.setState({ isRolling: true });
    await onRoll();
    useGameStore.setState({ isRolling: false });
  }, [canRoll, onRoll]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Dice */}
      <div className="flex justify-center gap-5">
        <DieFace value={diceResult?.[0] ?? 1} rolling={isRolling} />
        <DieFace value={diceResult?.[1] ?? 1} rolling={isRolling} />
      </div>

      {/* Total + Doubles indicator */}
      <AnimatePresence>
        {diceResult && !isRolling && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-1"
          >
            <span
              className="text-2xl font-black text-cyan-400"
              style={{ textShadow: '0 0 10px rgba(0,255,204,0.5)' }}
            >
              {diceResult[0] + diceResult[1]}
            </span>
            {isDoubles && (
              <motion.span
                className="text-xs font-bold text-yellow-400 px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ duration: 0.3 }}
              >
                DOBLES! {doublesCount > 1 ? `(${doublesCount}x)` : 'Tira de nuevo'}
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roll button */}
      <motion.button
        onClick={handleRoll}
        disabled={!canRoll}
        className={`
          px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-wider
          transition-all duration-300
          ${
            canRoll
              ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:from-cyan-400 hover:to-purple-500 shadow-lg shadow-cyan-500/25'
              : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
          }
        `}
        whileHover={canRoll ? { scale: 1.05 } : {}}
        whileTap={canRoll ? { scale: 0.95 } : {}}
      >
        {isRolling ? (
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 0.6 }}
          >
            Tirando...
          </motion.span>
        ) : (
          'Tirar Dados'
        )}
      </motion.button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BossChoiceModalProps {
  gameId: string;
  playerId: string;
  onClose: () => void;
}

export default function BossChoiceModal({ gameId, playerId, onClose }: BossChoiceModalProps) {
  const [choosing, setChoosing] = useState(false);

  const handleChoice = async (choice: 'pay' | 'jail') => {
    if (choosing) return;
    setChoosing(true);
    try {
      await fetch('/api/game/boss-choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId, choice }),
      });
      onClose();
    } finally {
      setChoosing(false);
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
          initial={{ scale: 0.5, rotateY: -180 }}
          animate={{ scale: 1, rotateY: 0 }}
          transition={{ type: 'spring', damping: 18 }}
        >
          <div className="bg-gradient-to-r from-red-900/60 to-purple-900/40 px-5 py-6 text-center">
            <motion.div
              className="text-5xl mb-2"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2 }}
            >
              👥
            </motion.div>
            <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-red-900/40 text-red-300 mb-2">
              BOSS FIGHT
            </span>
            <h2 className="text-lg font-black text-white">El Dúo Dinámico</h2>
            <p className="text-xs text-cyan-100/60 mt-1">Marlon y Kaito te dominan en la botlane</p>
          </div>

          <div className="p-5 space-y-3">
            <p className="text-sm text-cyan-100/80 leading-relaxed text-center">
              Elige tu destino: pagar tributo o fedear e ir al LAG.
            </p>

            <motion.button
              onClick={() => handleChoice('pay')}
              disabled={choosing}
              className="w-full py-3 rounded-xl bg-yellow-900/40 border border-yellow-500/30 text-yellow-300 font-bold text-sm hover:bg-yellow-800/40 disabled:opacity-40"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              💰 Pagar $300 de tributo
            </motion.button>

            <motion.button
              onClick={() => handleChoice('jail')}
              disabled={choosing}
              className="w-full py-3 rounded-xl bg-red-900/40 border border-red-500/30 text-red-300 font-bold text-sm hover:bg-red-800/40 disabled:opacity-40"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              ⏳ Ir al LAG (3 turnos)
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

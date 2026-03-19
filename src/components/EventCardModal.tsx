'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameEvent, SideQuest } from '@/lib/game/events-data';

function playEventSound(isBoss: boolean) {
  try {
    const ctx = new AudioContext();
    if (isBoss) {
      // Dramatic descending rumble
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
      osc1.type = 'sawtooth'; osc1.frequency.setValueAtTime(180, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.9);
      osc2.type = 'square'; osc2.frequency.setValueAtTime(90, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.9);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      osc1.start(); osc1.stop(ctx.currentTime + 1.0);
      osc2.start(); osc2.stop(ctx.currentTime + 1.0);
    } else {
      // Ascending arpeggio: C5 → E5 → G5
      const notes = [523, 659, 784];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t); osc.stop(t + 0.35);
      });
    }
  } catch {
    // AudioContext blocked (SSR / browser policy)
  }
}

interface EventCardModalProps {
  event: GameEvent | null;
  onClose: () => void;
  onPredict?: (prediction: 'even' | 'odd') => void;
  spectator?: boolean;
  playerName?: string;
}

export default function EventCardModal({ event, onClose, onPredict, spectator, playerName }: EventCardModalProps) {
  // Play sound when a new event appears
  useEffect(() => {
    if (!event) return;
    playEventSound(event.type === 'boss_fight');
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!event) return null;

  const isBoss = event.type === 'boss_fight';
  const isQuest = event.type === 'side_quest';
  const quest = isQuest ? (event as SideQuest) : null;
  const needsPrediction = quest?.requiresPrediction === true;

  const headerBg = isBoss
    ? 'linear-gradient(135deg, #1a0000, #4a0000)'
    : 'linear-gradient(135deg, #001a33, #003366)';
  const borderColor = isBoss ? 'border-red-500/40' : 'border-cyan-500/40';
  const glowColor = isBoss ? '#ff000033' : '#00bfff33';
  const labelBg = isBoss ? 'bg-red-900/40 text-red-300' : 'bg-cyan-900/40 text-cyan-300';
  const labelText = isBoss ? 'BOSS FIGHT' : 'MISIÓN SECUNDARIA';
  const btnBg = isBoss
    ? 'bg-red-800/60 hover:bg-red-700/60 border-red-500/40 text-red-200'
    : 'bg-cyan-800/60 hover:bg-cyan-700/60 border-cyan-500/40 text-cyan-200';

  const handleBackdrop = () => {
    // Don't allow closing by backdrop if prediction is required
    if (!needsPrediction) onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleBackdrop}
      >
        <motion.div
          className={`relative w-80 rounded-2xl overflow-hidden border ${borderColor} shadow-2xl`}
          style={{
            background: '#050d1a',
            boxShadow: `0 0 60px ${glowColor}, 0 30px 80px rgba(0,0,0,0.6)`,
            transformStyle: 'preserve-3d',
          }}
          initial={{ scale: 0.5, rotateY: -180, opacity: 0 }}
          animate={{ scale: 1, rotateY: 0, opacity: 1 }}
          exit={{ scale: 0.6, rotateY: 90, opacity: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-8 pb-6 text-center" style={{ background: headerBg }}>
            <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4 ${labelBg}`}>
              {labelText}
            </span>
            <motion.div
              className="text-6xl mb-3"
              animate={
                isBoss
                  ? { scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] }
                  : { scale: [1, 1.1, 1] }
              }
              transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2 }}
            >
              {event.icon}
            </motion.div>
            <h2 className="text-lg font-black text-white leading-tight px-2">
              {event.title}
            </h2>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Spectator badge */}
            {spectator && (
              <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800/60 border border-slate-700/40">
                <span className="text-base">👀</span>
                <span className="text-xs text-slate-400 font-medium">
                  {playerName ? `${playerName} recibió este evento` : 'Otro jugador recibió este evento'}
                </span>
              </div>
            )}

            <p className="text-sm text-cyan-100/80 leading-relaxed">
              {event.description}
            </p>

            {/* Quest details */}
            {quest && (
              <div className="space-y-2 pt-1 border-t border-cyan-900/30">
                {quest.immediateCost ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-red-400">💸</span>
                    <span className="text-red-300">Coste inmediato: -${quest.immediateCost}</span>
                  </div>
                ) : null}
                {quest.rewardAmount > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-400">💰</span>
                    <span className="text-green-300">Recompensa: +${quest.rewardAmount}</span>
                  </div>
                )}
                {quest.penaltyAmount > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-red-400">⚠️</span>
                    <span className="text-red-300">Penalización por fallo: -${quest.penaltyAmount}</span>
                  </div>
                )}
                {quest.progressTurns > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-yellow-400">⏳</span>
                    <span className="text-yellow-300">Duración: {quest.progressTurns} turno(s)</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions — hidden for spectators */}
            {!spectator && needsPrediction && onPredict ? (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-yellow-400 font-bold text-center uppercase tracking-widest">
                  ¿Par o Impar? — Elige AHORA
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    onClick={() => onPredict('even')}
                    className="py-3 rounded-xl border font-black text-sm bg-green-900/40 hover:bg-green-800/60 border-green-500/40 text-green-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    PAR 🎲
                  </motion.button>
                  <motion.button
                    onClick={() => onPredict('odd')}
                    className="py-3 rounded-xl border font-black text-sm bg-purple-900/40 hover:bg-purple-800/60 border-purple-500/40 text-purple-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    IMPAR 🎲
                  </motion.button>
                </div>
              </div>
            ) : !spectator ? (
              <motion.button
                onClick={onClose}
                className={`w-full py-3 rounded-xl border font-bold text-sm transition-colors ${btnBg}`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {isBoss ? '¡Afrontar el destino!' : '¡Aceptar la misión!'}
              </motion.button>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

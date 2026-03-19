'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { BOARD_TILES, isPropertyTile } from '@/data/board';

const TURN_SECONDS = 15;

interface ActionBarProps {
  onBuy: () => Promise<void>;
  onEndTurn: () => Promise<void>;
  onUsePower: (cardId: string, targetPlayerId?: string) => Promise<void>;
}

export default function ActionBar({ onBuy, onEndTurn, onUsePower }: ActionBarProps) {
  const { game, myPlayer, isMyTurn, properties, cards, myPlayerId, players, getPlayerName, pendingRent, doublesCount, diceResult } = useGameStore();
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const endingRef = useRef(false);

  const player = myPlayer();
  const myTurn = isMyTurn();
  const inActionPhase = game?.turn_phase === 'action';
  const timerActive = myTurn && inActionPhase && !pendingRent;

  // Countdown timer — resets whenever action phase starts for this player
  useEffect(() => {
    if (!timerActive) {
      setTimeLeft(TURN_SECONDS);
      endingRef.current = false;
      return;
    }

    setTimeLeft(TURN_SECONDS);
    endingRef.current = false;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!endingRef.current) {
            endingRef.current = true;
            onEndTurn();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurn, inActionPhase, pendingRent]);

  if (!player || !game) return null;

  const currentTile = BOARD_TILES[player.position_index];
  const prop = properties.find((p) => p.property_index === player.position_index);
  const justRolledDoubles = game.turn_phase === 'roll' && doublesCount > 0 && diceResult !== null;
  const canBuy =
    myTurn &&
    (game.turn_phase === 'action' || justRolledDoubles) &&
    isPropertyTile(currentTile) &&
    prop && !prop.owner_id &&
    currentTile.price && player.balance >= currentTile.price;

  const canEndTurn = myTurn && inActionPhase && !pendingRent;

  const myCards = cards.filter((c) => c.player_id === myPlayerId && !c.is_used);

  // Timer ring — SVG circle
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const progress = timerActive ? (timeLeft / TURN_SECONDS) : 1;
  const strokeDash = circumference * progress;
  const urgent = timeLeft <= 5 && timerActive;

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
        const targets = needsTarget ? players.filter((p) => p.id !== myPlayerId && !p.is_bankrupt) : [];

        return (
          <div key={card.id} className="relative group">
            <motion.button
              className="px-3 py-2 rounded-lg bg-purple-900/60 border border-purple-500/30 text-purple-300 text-xs font-bold hover:bg-purple-800/60"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { if (!needsTarget) onUsePower(card.id); }}
            >
              {cardNames[card.card_type] ?? card.card_type}
            </motion.button>
            {needsTarget && targets.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-slate-900 border border-cyan-900/30 rounded-lg overflow-hidden z-20">
                {targets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onUsePower(card.id, t.id)}
                    className="block w-full text-left px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-900/30"
                  >
                    <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: t.color }} />
                    {getPlayerName(t)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* End Turn + Timer */}
      {canEndTurn && (
        <motion.button
          onClick={onEndTurn}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition-colors ${
            urgent
              ? 'bg-red-900/60 border-red-500/60 text-red-300 hover:bg-red-800/60'
              : 'bg-slate-800/80 border-cyan-900/30 text-cyan-400/80 hover:bg-slate-700/80'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={urgent ? { scale: [1, 1.03, 1] } : {}}
          transition={urgent ? { repeat: Infinity, duration: 0.5 } : {}}
        >
          {/* SVG countdown ring */}
          <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0">
            {/* Background ring */}
            <circle cx="12" cy="12" r={radius} fill="none" strokeWidth="2.5"
              stroke={urgent ? 'rgba(239,68,68,0.2)' : 'rgba(34,211,238,0.1)'} />
            {/* Progress ring */}
            <circle cx="12" cy="12" r={radius} fill="none" strokeWidth="2.5"
              stroke={urgent ? '#ef4444' : '#22d3ee'}
              strokeDasharray={`${strokeDash} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 12 12)"
              style={{ transition: 'stroke-dasharray 0.9s linear' }}
            />
            {/* Number */}
            <text x="12" y="16" textAnchor="middle"
              fontSize="8" fontWeight="bold"
              fill={urgent ? '#ef4444' : '#22d3ee'}
            >
              {timeLeft}
            </text>
          </svg>
          Terminar Turno
        </motion.button>
      )}

      {/* Status */}
      {!myTurn && (
        <div className="text-xs text-cyan-500/40 animate-pulse">
          Esperando turno de otro jugador...
        </div>
      )}
    </div>
  );
}

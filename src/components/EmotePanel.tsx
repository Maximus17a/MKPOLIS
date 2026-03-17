'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { createClient } from '@/lib/supabase-client';

const EMOTES = [
  { id: 'laugh', emoji: '😂', label: 'Risa' },
  { id: 'poop', emoji: '💩', label: 'Caquita' },
  { id: 'angry', emoji: '😡', label: 'Enojo' },
  { id: 'confetti', emoji: '🎉', label: 'Confeti' },
  { id: 'skull', emoji: '💀', label: 'RIP' },
  { id: 'fire', emoji: '🔥', label: 'Fuego' },
  { id: 'gg', emoji: '🏆', label: 'GG' },
  { id: 'cry', emoji: '😭', label: 'Llorar' },
];

interface EmotePanelProps {
  gameId: string;
}

export default function EmotePanel({ gameId }: EmotePanelProps) {
  const { myPlayerId, players, getPlayerName } = useGameStore();
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);

  const otherPlayers = players.filter((p) => p.id !== myPlayerId && !p.is_bankrupt);

  const sendEmote = async (emoteId: string) => {
    if (cooldown || !myPlayerId) return;
    setCooldown(true);

    const supabase = createClient();
    const target = selectedTarget ? players.find((p) => p.id === selectedTarget) : null;
    const emote = EMOTES.find((e) => e.id === emoteId);

    const message = target
      ? `${emote?.emoji} → ${getPlayerName(target)}`
      : `${emote?.emoji}`;

    await supabase.from('game_logs').insert({
      game_id: gameId,
      player_id: myPlayerId,
      message,
      action_type: 'emote',
    });

    setTimeout(() => setCooldown(false), 1500);
  };

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-xs font-bold text-cyan-500/60 uppercase tracking-widest">
        Emotes
      </h3>

      {/* Target selector */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setSelectedTarget(null)}
          className={`px-2 py-1 rounded text-[10px] transition-colors ${
            !selectedTarget
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'bg-slate-800/50 text-cyan-500/40 border border-transparent hover:border-cyan-900/30'
          }`}
        >
          Todos
        </button>
        {otherPlayers.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedTarget(p.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
              selectedTarget === p.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800/50 text-cyan-500/40 border border-transparent hover:border-cyan-900/30'
            }`}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: p.color }}
            />
            {getPlayerName(p)}
          </button>
        ))}
      </div>

      {/* Emote grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {EMOTES.map((emote) => (
          <motion.button
            key={emote.id}
            onClick={() => sendEmote(emote.id)}
            disabled={cooldown}
            className={`
              flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-all
              ${cooldown
                ? 'border-cyan-900/10 opacity-40 cursor-not-allowed'
                : 'border-cyan-900/20 bg-slate-900/40 hover:bg-cyan-900/20 hover:border-cyan-500/30 cursor-pointer'
              }
            `}
            whileHover={!cooldown ? { scale: 1.1 } : {}}
            whileTap={!cooldown ? { scale: 0.9 } : {}}
          >
            <span className="text-xl">{emote.emoji}</span>
            <span className="text-[8px] text-cyan-500/40">{emote.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

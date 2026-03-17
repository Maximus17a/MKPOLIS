'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { playEmoteSound } from '@/lib/sounds';

const EMOJI_TO_ID: Record<string, string> = {
  '😂': 'laugh', '💩': 'poop', '😡': 'angry', '🎉': 'confetti',
  '💀': 'skull', '🔥': 'fire', '🏆': 'gg', '😭': 'cry',
};

interface EmoteDisplay {
  id: string;
  emoji: string;
  playerName: string;
  playerColor: string;
  timestamp: number;
}

export default function EmoteBubble() {
  const { logs, players, getPlayerName } = useGameStore();
  const [emotes, setEmotes] = useState<EmoteDisplay[]>([]);

  useEffect(() => {
    // Watch for new emote logs
    const emoteLogs = logs.filter((l) => l.action_type === 'emote');
    if (emoteLogs.length === 0) return;

    const latest = emoteLogs[emoteLogs.length - 1];
    const now = Date.now();
    const logTime = new Date(latest.created_at).getTime();

    // Only show emotes from the last 5 seconds
    if (now - logTime > 5000) return;

    const player = players.find((p) => p.id === latest.player_id);
    if (!player) return;

    // Extract emoji from message (first character or emoji)
    const emojiMatch = latest.message.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
    const emoji = emojiMatch ? emojiMatch[0] : latest.message.slice(0, 2);

    const newEmote: EmoteDisplay = {
      id: latest.id,
      emoji,
      playerName: getPlayerName(player),
      playerColor: player.color,
      timestamp: logTime,
    };

    setEmotes((prev) => {
      // Avoid duplicates
      if (prev.some((e) => e.id === newEmote.id)) return prev;
      // Play emote sound
      const emoteId = EMOJI_TO_ID[emoji] ?? 'laugh';
      playEmoteSound(emoteId);
      return [...prev.slice(-4), newEmote];
    });

    // Remove after 3 seconds
    setTimeout(() => {
      setEmotes((prev) => prev.filter((e) => e.id !== newEmote.id));
    }, 3000);
  }, [logs, players, getPlayerName]);

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {emotes.map((emote) => (
          <motion.div
            key={emote.id}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-cyan-500/20 bg-slate-900/90 backdrop-blur-sm shadow-xl"
            initial={{ opacity: 0, y: 30, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: emote.playerColor }}
            />
            <span className="text-xs text-cyan-300/80">{emote.playerName}</span>
            <motion.span
              className="text-3xl"
              animate={{
                scale: [1, 1.4, 1],
                rotate: [0, 10, -10, 0],
              }}
              transition={{ duration: 0.5 }}
            >
              {emote.emoji}
            </motion.span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

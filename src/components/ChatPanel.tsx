'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { createClient } from '@/lib/supabase-client';
import { playChatSound, playChatSendSound } from '@/lib/sounds';

interface ChatPanelProps {
  gameId: string;
}

export default function ChatPanel({ gameId }: ChatPanelProps) {
  const { myPlayerId, players, logs, getPlayerName } = useGameStore();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMessages = logs.filter((l) => l.action_type === 'chat');

  const prevCountRef = useRef(chatMessages.length);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Play receive sound for new messages (not on initial load)
    if (chatMessages.length > prevCountRef.current && prevCountRef.current > 0) {
      playChatSound();
    }
    prevCountRef.current = chatMessages.length;
  }, [chatMessages.length]);

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || !myPlayerId || sending) return;

    setSending(true);
    setMessage('');
    playChatSendSound();

    const supabase = createClient();
    await supabase.from('game_logs').insert({
      game_id: gameId,
      player_id: myPlayerId,
      message: text,
      action_type: 'chat',
    });

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getPlayerForLog = (playerId: string | null) => {
    if (!playerId) return null;
    return players.find((p) => p.id === playerId);
  };

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-xs font-bold text-cyan-500/60 uppercase tracking-widest mb-2 px-1">
        Chat
      </h3>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-cyan-900/30 mb-2"
        style={{ maxHeight: '200px' }}
      >
        <AnimatePresence initial={false}>
          {chatMessages.map((msg) => {
            const player = getPlayerForLog(msg.player_id);
            const isMe = player?.id === myPlayerId;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-2"
              >
                <div className="flex items-start gap-1.5">
                  {player && (
                    <span
                      className="inline-block w-2 h-2 rounded-full mt-1 shrink-0"
                      style={{ background: player.color }}
                    />
                  )}
                  <div className="min-w-0">
                    <span
                      className={`text-[10px] font-bold ${
                        isMe ? 'text-cyan-400' : 'text-cyan-500/70'
                      }`}
                    >
                      {player ? getPlayerName(player) : '???'}
                    </span>
                    <p className="text-xs text-cyan-100/80 break-words leading-tight">
                      {msg.message}
                    </p>
                  </div>
                  <span className="text-[9px] text-cyan-500/30 ml-auto shrink-0 mt-0.5">
                    {new Date(msg.created_at).toLocaleTimeString('es', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {chatMessages.length === 0 && (
          <div className="text-xs text-cyan-500/30 text-center py-4">
            Sin mensajes aun...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          maxLength={200}
          className="flex-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-cyan-900/30 text-xs text-cyan-100 placeholder-cyan-500/30 focus:outline-none focus:border-cyan-500/50"
        />
        <button
          onClick={sendMessage}
          disabled={!message.trim() || sending}
          className="px-3 py-2 rounded-lg bg-cyan-600/30 border border-cyan-500/30 text-xs text-cyan-300 hover:bg-cyan-600/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

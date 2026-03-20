'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';

export default function GameLog() {
  const { logs: allLogs } = useGameStore();
  const logs = allLogs.filter((l) => l.action_type !== 'chat');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  const actionColors: Record<string, string> = {
    roll: 'text-cyan-400',
    buy: 'text-green-400',
    rent: 'text-yellow-400',
    power_card: 'text-purple-400',
    stun: 'text-red-400',
    jail: 'text-orange-400',
    jail_escape: 'text-green-400',
    bankrupt: 'text-red-500',
    game_over: 'text-yellow-500',
    create: 'text-cyan-500/60',
    join: 'text-cyan-500/60',
    start: 'text-cyan-400',
    end_turn: 'text-cyan-500/40',
    emote: 'text-white',
    upgrade: 'text-cyan-300',
    boss_fight: 'text-red-400',
    power_card: 'text-yellow-400',
    trade: 'text-purple-400',
    mortgage: 'text-yellow-500',
    sell: 'text-orange-400',
  };

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-xs font-bold text-cyan-500/60 uppercase tracking-widest mb-2 px-1">
        Feed de Juego
      </h3>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-cyan-900/30"
        style={{ maxHeight: '40vh' }}
      >
        <AnimatePresence initial={false}>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`text-xs py-1 px-2 rounded ${
                actionColors[log.action_type] ?? 'text-cyan-100/50'
              }`}
            >
              <span className="opacity-50 text-[10px]">
                {new Date(log.created_at).toLocaleTimeString('es', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>{' '}
              {log.message}
            </motion.div>
          ))}
        </AnimatePresence>

        {logs.length === 0 && (
          <div className="text-xs text-cyan-500/30 text-center py-8">
            Esperando acciones...
          </div>
        )}
      </div>
    </div>
  );
}

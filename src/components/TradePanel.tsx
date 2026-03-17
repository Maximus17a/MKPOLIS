'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { BOARD_TILES, COLOR_MAP, type ColorGroup } from '@/data/board';

interface TradePanelProps {
  gameId: string;
}

export default function TradePanel({ gameId }: TradePanelProps) {
  const { myPlayerId, players, properties, getPlayerName } = useGameStore();
  const [open, setOpen] = useState(false);
  const [targetPlayer, setTargetPlayer] = useState<string | null>(null);
  const [offeredMoney, setOfferedMoney] = useState(0);
  const [requestedMoney, setRequestedMoney] = useState(0);
  const [offeredProps, setOfferedProps] = useState<number[]>([]);
  const [requestedProps, setRequestedProps] = useState<number[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const otherPlayers = players.filter((p) => p.id !== myPlayerId && !p.is_bankrupt);
  const myProps = properties.filter((p) => p.owner_id === myPlayerId && !p.is_mortgaged);
  const targetProps = targetPlayer
    ? properties.filter((p) => p.owner_id === targetPlayer && !p.is_mortgaged)
    : [];

  const toggleProp = (list: number[], setList: (v: number[]) => void, idx: number) => {
    setList(list.includes(idx) ? list.filter((i) => i !== idx) : [...list, idx]);
  };

  const sendOffer = async () => {
    if (!targetPlayer || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/game/trade/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          senderId: myPlayerId,
          receiverId: targetPlayer,
          offeredMoney,
          requestedMoney,
          offeredProperties: offeredProps,
          requestedProperties: requestedProps,
        }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => {
          setSent(false);
          setOpen(false);
          resetForm();
        }, 1500);
      }
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setTargetPlayer(null);
    setOfferedMoney(0);
    setRequestedMoney(0);
    setOfferedProps([]);
    setRequestedProps([]);
  };

  const PropChip = ({ idx, selected, onClick }: { idx: number; selected: boolean; onClick: () => void }) => {
    const tile = BOARD_TILES[idx];
    if (!tile) return null;
    const color = tile.colorGroup ? COLOR_MAP[tile.colorGroup as ColorGroup] : '#444';
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all border ${
          selected
            ? 'border-cyan-400/60 bg-cyan-900/30 text-cyan-200'
            : 'border-cyan-900/20 bg-slate-900/40 text-cyan-400/60 hover:border-cyan-700/40'
        }`}
      >
        <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
        <span className="truncate max-w-[80px]">{tile.name}</span>
      </button>
    );
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 rounded-lg bg-purple-900/30 border border-purple-500/20 text-purple-300 text-xs font-bold hover:bg-purple-800/30 transition-colors"
      >
        🤝 Negociar
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 rounded-xl border border-purple-900/30 bg-slate-900/60 space-y-3">
              {sent ? (
                <p className="text-xs text-green-400 text-center py-4">Oferta enviada!</p>
              ) : (
                <>
                  {/* Target player */}
                  <div>
                    <label className="text-[10px] text-cyan-500/50 uppercase tracking-wider">Negociar con</label>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {otherPlayers.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setTargetPlayer(p.id); setRequestedProps([]); }}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors ${
                            targetPlayer === p.id
                              ? 'border-cyan-400/50 bg-cyan-900/30 text-cyan-200'
                              : 'border-cyan-900/20 text-cyan-500/50 hover:border-cyan-700/30'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                          {getPlayerName(p)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {targetPlayer && (
                    <>
                      {/* Offered */}
                      <div>
                        <label className="text-[10px] text-green-400/60 uppercase tracking-wider">Yo ofrezco</label>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-cyan-400/50">$</span>
                          <input
                            type="number"
                            min={0}
                            value={offeredMoney}
                            onChange={(e) => setOfferedMoney(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-20 px-2 py-1 rounded bg-slate-800/60 border border-cyan-900/20 text-xs text-cyan-100 focus:outline-none focus:border-cyan-500/40"
                          />
                        </div>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {myProps.map((p) => (
                            <PropChip
                              key={p.property_index}
                              idx={p.property_index}
                              selected={offeredProps.includes(p.property_index)}
                              onClick={() => toggleProp(offeredProps, setOfferedProps, p.property_index)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Requested */}
                      <div>
                        <label className="text-[10px] text-red-400/60 uppercase tracking-wider">Yo pido</label>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-cyan-400/50">$</span>
                          <input
                            type="number"
                            min={0}
                            value={requestedMoney}
                            onChange={(e) => setRequestedMoney(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-20 px-2 py-1 rounded bg-slate-800/60 border border-cyan-900/20 text-xs text-cyan-100 focus:outline-none focus:border-cyan-500/40"
                          />
                        </div>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {targetProps.map((p) => (
                            <PropChip
                              key={p.property_index}
                              idx={p.property_index}
                              selected={requestedProps.includes(p.property_index)}
                              onClick={() => toggleProp(requestedProps, setRequestedProps, p.property_index)}
                            />
                          ))}
                          {targetProps.length === 0 && (
                            <span className="text-[10px] text-cyan-500/30">Sin propiedades disponibles</span>
                          )}
                        </div>
                      </div>

                      {/* Send */}
                      <motion.button
                        onClick={sendOffer}
                        disabled={sending || (offeredMoney === 0 && offeredProps.length === 0 && requestedMoney === 0 && requestedProps.length === 0)}
                        className="w-full py-2 rounded-lg bg-purple-700/40 border border-purple-500/30 text-purple-200 text-xs font-bold hover:bg-purple-600/40 disabled:opacity-30"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {sending ? 'Enviando...' : 'Enviar Oferta'}
                      </motion.button>
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

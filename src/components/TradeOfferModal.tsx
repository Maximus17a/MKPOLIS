'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { createClient } from '@/lib/supabase-client';
import { BOARD_TILES, COLOR_MAP, type ColorGroup } from '@/data/board';
import type { TradeOffer } from '@/lib/database.types';

interface TradeOfferModalProps {
  gameId: string;
}

export default function TradeOfferModal({ gameId }: TradeOfferModalProps) {
  const { myPlayerId, players, getPlayerName } = useGameStore();
  const [offer, setOffer] = useState<TradeOffer | null>(null);
  const [responding, setResponding] = useState(false);

  // Listen for pending trade offers addressed to me
  useEffect(() => {
    if (!myPlayerId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`trades-${myPlayerId}`)
      .on(
        'postgres_changes' as 'system',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_offers',
          filter: `receiver_id=eq.${myPlayerId}`,
        } as Record<string, string>,
        (payload: { new: TradeOffer }) => {
          if (payload.new.status === 'pending') {
            setOffer(payload.new);
          }
        }
      )
      .subscribe();

    // Also check for existing pending offers on mount
    supabase
      .from('trade_offers')
      .select('*')
      .eq('receiver_id', myPlayerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setOffer(data);
      });

    return () => { supabase.removeChannel(channel); };
  }, [myPlayerId]);

  const respond = async (accept: boolean) => {
    if (!offer || responding) return;
    setResponding(true);
    try {
      await fetch('/api/game/trade/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id, playerId: myPlayerId, accept }),
      });
      setOffer(null);
    } finally {
      setResponding(false);
    }
  };

  if (!offer) return null;

  const sender = players.find((p) => p.id === offer.sender_id);

  const PropList = ({ indices, label }: { indices: number[]; label: string }) => {
    if (indices.length === 0) return null;
    return (
      <div className="space-y-0.5">
        <span className="text-[10px] text-cyan-500/50">{label}:</span>
        {indices.map((idx) => {
          const tile = BOARD_TILES[idx];
          if (!tile) return null;
          const color = tile.colorGroup ? COLOR_MAP[tile.colorGroup as ColorGroup] : '#444';
          return (
            <div key={idx} className="flex items-center gap-1 text-[11px] text-cyan-200">
              <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
              {tile.name}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-80 rounded-2xl border border-purple-500/40 bg-slate-950 overflow-hidden shadow-2xl"
          style={{ boxShadow: '0 0 40px #9333ea22' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="bg-gradient-to-r from-purple-900/60 to-cyan-900/40 px-5 py-4 text-center">
            <div className="text-3xl mb-1">🤝</div>
            <h2 className="text-lg font-black text-purple-300">Oferta de Intercambio</h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              {sender && (
                <>
                  <span className="w-3 h-3 rounded-full" style={{ background: sender.color }} />
                  <span className="text-xs text-cyan-200">{getPlayerName(sender)}</span>
                </>
              )}
            </div>
          </div>

          <div className="p-5 space-y-3">
            {/* What they offer */}
            <div className="p-3 rounded-lg bg-green-900/10 border border-green-500/20">
              <p className="text-[10px] text-green-400 uppercase tracking-wider mb-1">Te ofrece</p>
              {offer.offered_money > 0 && (
                <div className="text-sm text-green-300 font-bold">${offer.offered_money}</div>
              )}
              <PropList indices={offer.offered_properties} label="Propiedades" />
              {offer.offered_money === 0 && offer.offered_properties.length === 0 && (
                <span className="text-xs text-cyan-500/30">Nada</span>
              )}
            </div>

            {/* What they want */}
            <div className="p-3 rounded-lg bg-red-900/10 border border-red-500/20">
              <p className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Te pide</p>
              {offer.requested_money > 0 && (
                <div className="text-sm text-red-300 font-bold">${offer.requested_money}</div>
              )}
              <PropList indices={offer.requested_properties} label="Propiedades" />
              {offer.requested_money === 0 && offer.requested_properties.length === 0 && (
                <span className="text-xs text-cyan-500/30">Nada</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <motion.button
                onClick={() => respond(true)}
                disabled={responding}
                className="flex-1 py-2.5 rounded-xl bg-green-800/40 border border-green-500/30 text-green-300 text-xs font-bold hover:bg-green-700/40 disabled:opacity-40"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Aceptar
              </motion.button>
              <motion.button
                onClick={() => respond(false)}
                disabled={responding}
                className="flex-1 py-2.5 rounded-xl bg-red-800/40 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-700/40 disabled:opacity-40"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Rechazar
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

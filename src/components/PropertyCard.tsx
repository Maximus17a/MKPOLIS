'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { BOARD_TILES, COLOR_MAP, type ColorGroup } from '@/data/board';

export default function PropertyCard() {
  const { showPropertyCard, setShowPropertyCard, properties, players, getPlayerName } = useGameStore();

  if (showPropertyCard === null) return null;

  const tile = BOARD_TILES[showPropertyCard];
  if (!tile) return null;

  const prop = properties.find((p) => p.property_index === showPropertyCard);
  const owner = prop?.owner_id ? players.find((p) => p.id === prop.owner_id) : null;
  const colorHex = tile.colorGroup ? COLOR_MAP[tile.colorGroup as ColorGroup] : '#334';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowPropertyCard(null)}
      >
        <motion.div
          className="relative w-72 rounded-2xl overflow-hidden border border-cyan-500/30"
          style={{
            background: 'linear-gradient(180deg, #0a1628, #0d1b2a)',
            boxShadow: `0 0 40px ${colorHex}33, 0 20px 60px rgba(0,0,0,0.5)`,
            transformStyle: 'preserve-3d',
          }}
          initial={{ scale: 0.8, rotateY: -30, opacity: 0 }}
          animate={{ scale: 1, rotateY: 0, opacity: 1 }}
          exit={{ scale: 0.8, rotateY: 30, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Color header */}
          <div
            className="h-20 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${colorHex}, ${colorHex}cc)` }}
          >
            <h3 className="text-white font-black text-lg text-center px-4 drop-shadow-lg">
              {tile.name}
            </h3>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Price */}
            {tile.price && (
              <div className="text-center">
                <span className="text-cyan-400/60 text-xs">Precio</span>
                <div className="text-2xl font-black text-cyan-300">${tile.price}</div>
              </div>
            )}

            {/* Rent table */}
            {tile.rent && (
              <div className="space-y-1">
                <div className="text-[10px] text-cyan-500/50 uppercase tracking-wider">
                  Alquiler por nivel
                </div>
                {tile.rent.map((r, i) => (
                  <div
                    key={i}
                    className={`flex justify-between text-xs py-0.5 px-2 rounded ${
                      prop?.server_level === i ? 'bg-cyan-500/10 text-cyan-300' : 'text-cyan-100/50'
                    }`}
                  >
                    <span>{i === 0 ? 'Base' : `Servidor Lv.${i}`}</span>
                    <span className="font-mono">${r}</span>
                  </div>
                ))}
                {tile.buildCost && (
                  <div className="text-[10px] text-cyan-400/40 mt-1">
                    Upgrade: ${tile.buildCost} por servidor
                  </div>
                )}
              </div>
            )}

            {/* Station / Utility info */}
            {tile.type === 'station' && (
              <div className="text-xs text-cyan-100/60 text-center">
                Tarifa base: ${tile.stationFee} × estaciones propias
              </div>
            )}
            {tile.type === 'utility' && (
              <div className="text-xs text-cyan-100/60 text-center">
                Multiplicador: ×{tile.utilityMultiplier} × tirada de dados
              </div>
            )}

            {/* Owner */}
            {owner && (
              <div className="flex items-center gap-2 pt-2 border-t border-cyan-900/30">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ background: owner.color, boxShadow: `0 0 6px ${owner.color}` }}
                />
                <span className="text-xs text-cyan-300/80">
                  Propiedad de {getPlayerName(owner)}
                </span>
              </div>
            )}

            {!owner && tile.price && (
              <div className="text-center text-xs text-green-400/60 pt-2 border-t border-cyan-900/30">
                ✨ Disponible para compra
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={() => setShowPropertyCard(null)}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 text-cyan-400/60 hover:text-white text-xs flex items-center justify-center"
          >
            ✕
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

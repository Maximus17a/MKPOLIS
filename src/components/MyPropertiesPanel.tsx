'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { BOARD_TILES, COLOR_MAP, getPropertiesInGroup, type ColorGroup } from '@/data/board';

interface MyPropertiesPanelProps {
  gameId: string;
  onUpgrade: (propertyIndex: number) => Promise<void>;
}

export default function MyPropertiesPanel({ gameId, onUpgrade }: MyPropertiesPanelProps) {
  const { myPlayerId, properties, players, game, isMyTurn } = useGameStore();
  const [expanded, setExpanded] = useState(true);
  const [upgrading, setUpgrading] = useState<number | null>(null);
  const [acting, setActing] = useState<string | null>(null); // 'mortgage-X' | 'sell-X'

  const myProperties = properties.filter((p) => p.owner_id === myPlayerId);
  const player = players.find((p) => p.id === myPlayerId);

  if (!player) return null;

  const grouped: Record<string, typeof myProperties> = {};
  for (const prop of myProperties) {
    const tile = BOARD_TILES[prop.property_index];
    const group = tile?.colorGroup ?? tile?.type ?? 'other';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(prop);
  }

  const ownsFullGroup = (colorGroup: string): boolean => {
    const groupTiles = getPropertiesInGroup(colorGroup as ColorGroup);
    return groupTiles.every((t) => myProperties.some((p) => p.property_index === t.index));
  };

  const handleUpgrade = async (propertyIndex: number) => {
    if (upgrading !== null) return;
    setUpgrading(propertyIndex);
    try { await onUpgrade(propertyIndex); } finally { setUpgrading(null); }
  };

  const handleMortgage = async (propertyIndex: number, action: 'mortgage' | 'unmortgage') => {
    const key = `${action}-${propertyIndex}`;
    if (acting) return;
    setActing(key);
    try {
      await fetch('/api/game/mortgage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId: myPlayerId, propertyIndex, action }),
      });
    } finally { setActing(null); }
  };

  const handleSell = async (propertyIndex: number) => {
    const key = `sell-${propertyIndex}`;
    if (acting) return;
    setActing(key);
    try {
      await fetch('/api/game/sell-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerId: myPlayerId, propertyIndex }),
      });
    } finally { setActing(null); }
  };

  const canAct = isMyTurn() && game?.turn_phase === 'action';
  // Also allow mortgage/sell when in debt (balance < 0)
  const inDebt = player.balance < 0;
  const canManage = canAct || inDebt;

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <h3 className="text-xs font-bold text-cyan-500/60 uppercase tracking-widest">
          Mis Propiedades ({myProperties.length})
        </h3>
        <span className="text-cyan-500/40 text-xs">{expanded ? '▼' : '▶'}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {myProperties.length === 0 ? (
              <p className="text-xs text-cyan-500/30 py-3 text-center">No tienes propiedades aun</p>
            ) : (
              <div className="space-y-1 mt-2">
                {Object.entries(grouped).map(([group, props]) => {
                  const colorHex = COLOR_MAP[group as ColorGroup] ?? '#444';
                  const fullGroup = ownsFullGroup(group);

                  return (
                    <div key={group} className="space-y-0.5">
                      <div className="flex items-center gap-1.5 px-1 pt-1">
                        <div className="w-3 h-2 rounded-sm" style={{ background: colorHex }} />
                        <span className="text-[10px] text-cyan-500/50 uppercase tracking-wider">
                          {group.replace('_', ' ')}
                        </span>
                        {fullGroup && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                            MONOPOLIO
                          </span>
                        )}
                      </div>

                      {props.map((prop) => {
                        const tile = BOARD_TILES[prop.property_index];
                        if (!tile) return null;

                        const currentRent = tile.rent?.[prop.server_level] ?? 0;
                        const mortgageValue = Math.floor((tile.price ?? 0) / 2);
                        const unmortgageCost = Math.floor(mortgageValue * 1.1);

                        const canUpgradeThis =
                          canAct && fullGroup && tile.type === 'property' &&
                          prop.server_level < 5 && !prop.is_mortgaged &&
                          tile.buildCost && player.balance >= tile.buildCost;

                        let evenBuildOk = true;
                        if (canUpgradeThis && tile.colorGroup) {
                          const groupProps = myProperties.filter((p) => {
                            const t = BOARD_TILES[p.property_index];
                            return t?.colorGroup === tile.colorGroup;
                          });
                          const levels = groupProps.map((p) =>
                            p.property_index === prop.property_index ? prop.server_level + 1 : p.server_level
                          );
                          evenBuildOk = Math.max(...levels) - Math.min(...levels) <= 1;
                        }

                        const showUpgrade = canUpgradeThis && evenBuildOk;
                        const canMortgage = canManage && !prop.is_mortgaged && prop.server_level === 0;
                        const canUnmortgage = canManage && prop.is_mortgaged && player.balance >= unmortgageCost;
                        const canSell = canManage && prop.server_level === 0;

                        return (
                          <div
                            key={prop.id}
                            className={`px-2 py-1.5 rounded-lg border ${
                              prop.is_mortgaged
                                ? 'bg-red-950/20 border-red-900/30 opacity-70'
                                : 'bg-slate-900/40 border-cyan-900/15'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-8 rounded-full shrink-0" style={{ background: colorHex }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] text-cyan-200 font-medium truncate">
                                  {tile.name}
                                  {prop.is_mortgaged && (
                                    <span className="text-red-400 text-[9px] ml-1">HIPOTECADA</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px]">
                                  <span className={prop.is_mortgaged ? 'text-red-400/50 line-through' : 'text-yellow-400/70'}>
                                    Renta: ${currentRent}
                                  </span>
                                  {tile.type === 'property' && (
                                    <span className="text-cyan-500/40">Lv.{prop.server_level}</span>
                                  )}
                                </div>
                              </div>

                              {tile.type === 'property' && (
                                <div className="flex gap-0.5 shrink-0">
                                  {Array.from({ length: 5 }, (_, i) => (
                                    <div
                                      key={i}
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        i < prop.server_level ? 'bg-cyan-400' : 'bg-cyan-900/30'
                                      }`}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Action buttons row */}
                            {canManage && (
                              <div className="flex gap-1 mt-1.5 flex-wrap">
                                {showUpgrade && (
                                  <motion.button
                                    onClick={() => handleUpgrade(prop.property_index)}
                                    disabled={upgrading === prop.property_index}
                                    className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/50 disabled:opacity-40"
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    {upgrading === prop.property_index ? '...' : `↑ Mejorar $${tile.buildCost}`}
                                  </motion.button>
                                )}

                                {canMortgage && (
                                  <motion.button
                                    onClick={() => handleMortgage(prop.property_index, 'mortgage')}
                                    disabled={acting === `mortgage-${prop.property_index}`}
                                    className="px-2 py-0.5 rounded text-[9px] font-bold bg-yellow-900/30 border border-yellow-600/30 text-yellow-400 hover:bg-yellow-800/30 disabled:opacity-40"
                                    whileTap={{ scale: 0.95 }}
                                    title={`Hipotecar: recibes $${mortgageValue}`}
                                  >
                                    🏦 Hipotecar +${mortgageValue}
                                  </motion.button>
                                )}

                                {canUnmortgage && (
                                  <motion.button
                                    onClick={() => handleMortgage(prop.property_index, 'unmortgage')}
                                    disabled={acting === `unmortgage-${prop.property_index}`}
                                    className="px-2 py-0.5 rounded text-[9px] font-bold bg-green-900/30 border border-green-600/30 text-green-400 hover:bg-green-800/30 disabled:opacity-40"
                                    whileTap={{ scale: 0.95 }}
                                    title={`Deshipotecar: pagas $${unmortgageCost}`}
                                  >
                                    ✅ Deshipotecar -${unmortgageCost}
                                  </motion.button>
                                )}

                                {canSell && (
                                  <motion.button
                                    onClick={() => handleSell(prop.property_index)}
                                    disabled={acting === `sell-${prop.property_index}`}
                                    className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-900/30 border border-red-600/30 text-red-400 hover:bg-red-800/30 disabled:opacity-40"
                                    whileTap={{ scale: 0.95 }}
                                    title={`Vender al banco por $${prop.is_mortgaged ? 0 : mortgageValue}`}
                                  >
                                    💸 Vender ${prop.is_mortgaged ? 0 : mortgageValue}
                                  </motion.button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

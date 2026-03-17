'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { BOARD_TILES } from '@/data/board';

export default function PlayerPanel() {
  const { players, game, myPlayerId, properties, getPlayerName } = useGameStore();

  const getPlayerProperties = (playerId: string) =>
    properties.filter((p) => p.owner_id === playerId);

  return (
    <div className="flex flex-col gap-3 w-72">
      <h2 className="text-xs font-bold text-cyan-500/60 uppercase tracking-widest mb-1">
        Jugadores
      </h2>

      {players
        .slice()
        .sort((a, b) => a.turn_order - b.turn_order)
        .map((player) => {
          const isCurrentTurn = game?.current_turn_player_id === player.id;
          const isMe = player.id === myPlayerId;
          const ownedProps = getPlayerProperties(player.id);
          const tile = BOARD_TILES[player.position_index];

          return (
            <motion.div
              key={player.id}
              className={`
                relative rounded-xl p-3 border transition-all duration-300
                ${
                  isCurrentTurn
                    ? 'border-cyan-400/60 bg-cyan-950/40'
                    : 'border-cyan-900/20 bg-slate-900/60'
                }
                ${player.is_bankrupt ? 'opacity-40 grayscale' : ''}
              `}
              layout
              animate={isCurrentTurn ? { boxShadow: `0 0 15px ${player.color}33` } : {}}
            >
              {/* Turn indicator */}
              {isCurrentTurn && (
                <motion.div
                  className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full"
                  style={{ background: player.color }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}

              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-black"
                  style={{
                    background: player.color,
                    boxShadow: `0 0 10px ${player.color}44`,
                  }}
                >
                  P{player.turn_order + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {getPlayerName(player)}
                    {player.is_bankrupt && (
                      <span className="text-red-400 text-xs ml-1">💀</span>
                    )}
                  </div>
                  <div className="text-[10px] text-cyan-400/50 truncate">
                    📍 {tile?.name ?? 'SALIDA'}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">💰</span>
                  <span
                    className={`font-mono font-bold ${
                      player.balance < 100 ? 'text-red-400' : 'text-green-400'
                    }`}
                  >
                    ${player.balance}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-cyan-400/60">
                  <span>🏠</span>
                  <span>{ownedProps.length}</span>
                </div>
                {player.jail_turns_remaining > 0 && (
                  <span className="text-orange-400 text-[10px]">
                    ⏳ LAG ({player.jail_turns_remaining})
                  </span>
                )}
                {player.stun_turns_remaining > 0 && (
                  <span className="text-purple-400 text-[10px]">
                    ⚡ Stun ({player.stun_turns_remaining})
                  </span>
                )}
              </div>

              {/* Owned properties mini-bar */}
              {ownedProps.length > 0 && (
                <div className="flex gap-0.5 mt-2 flex-wrap">
                  {ownedProps.map((prop) => {
                    const tileData = BOARD_TILES[prop.property_index];
                    const color = tileData?.colorGroup
                      ? (
                          {
                            blue: '#1e3a5f',
                            green: '#0f5132',
                            brown: '#5c3d2e',
                            orange: '#e65100',
                            pink: '#ad1457',
                            yellow: '#f9a825',
                            gray_light: '#546e7a',
                            gray_dark: '#37474f',
                          } as Record<string, string>
                        )[tileData.colorGroup] ?? '#444'
                      : '#444';

                    return (
                      <div
                        key={prop.id}
                        className="w-4 h-2 rounded-sm"
                        style={{ background: color }}
                        title={tileData?.name}
                      />
                    );
                  })}
                </div>
              )}
            </motion.div>
          );
        })}
    </div>
  );
}

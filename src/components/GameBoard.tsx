'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BOARD_TILES, COLOR_MAP, PLAYER_PIECES, type TileData, type ColorGroup } from '@/data/board';
import { useGameStore } from '@/store/useGameStore';
import { useSteppingAnimation } from '@/hooks/useSteppingAnimation';

// Board layout: 11x11 grid, tiles along the edges
function getTilePosition(index: number): { row: number; col: number } {
  if (index <= 10) return { row: 10, col: 10 - index };
  if (index <= 19) return { row: 10 - (index - 10), col: 0 };
  if (index <= 30) return { row: 0, col: index - 20 };
  return { row: index - 30, col: 10 };
}

function isCorner(index: number): boolean {
  return [0, 10, 20, 30].includes(index);
}

// ── Server Icon (Blade Server with LED) ──
function ServerIcon({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      className="w-[8px] h-[12px] rounded-[1px] relative"
      style={{
        background: 'linear-gradient(180deg, #1a2332, #0d1520)',
        border: '0.5px solid #00ffcc33',
        boxShadow: '0 0 4px #00ffcc22',
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: delay * 0.1, type: 'spring', stiffness: 400, damping: 15 }}
    >
      {/* LED lights */}
      <motion.div
        className="absolute top-[2px] left-[1px] w-[2px] h-[2px] rounded-full"
        style={{ background: '#00ffcc' }}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.5, delay: delay * 0.2 }}
      />
      <motion.div
        className="absolute top-[5px] left-[1px] w-[2px] h-[2px] rounded-full"
        style={{ background: '#00ff88' }}
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ repeat: Infinity, duration: 2, delay: delay * 0.3 }}
      />
    </motion.div>
  );
}

// ── Data Center Icon (Mainframe Tower) ──
function DatacenterIcon() {
  return (
    <motion.div
      className="relative w-[20px] h-[18px] rounded-[2px]"
      style={{
        background: 'linear-gradient(180deg, #0a1628, #050d1a)',
        border: '1px solid #00ffcc55',
        boxShadow: '0 0 8px #00ffcc33, 0 0 16px #00ffcc11',
      }}
      initial={{ scale: 0, rotateY: 90 }}
      animate={{ scale: 1, rotateY: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
    >
      {/* LED rack rows */}
      {[2, 6, 10, 14].map((top) => (
        <motion.div
          key={top}
          className="absolute left-[3px] right-[3px] h-[2px] rounded-full"
          style={{ top: `${top}px`, background: '#00ffcc' }}
          animate={{
            opacity: [0.3, 1, 0.3],
            boxShadow: ['0 0 2px #00ffcc44', '0 0 6px #00ffccaa', '0 0 2px #00ffcc44'],
          }}
          transition={{ repeat: Infinity, duration: 1.2, delay: top * 0.08 }}
        />
      ))}
      {/* Center power indicator */}
      <motion.div
        className="absolute bottom-[1px] left-1/2 -translate-x-1/2 w-[4px] h-[4px] rounded-full"
        style={{ background: '#ff6600' }}
        animate={{
          opacity: [0.5, 1, 0.5],
          boxShadow: ['0 0 2px #ff660066', '0 0 6px #ff6600cc', '0 0 2px #ff660066'],
        }}
        transition={{ repeat: Infinity, duration: 0.8 }}
      />
    </motion.div>
  );
}

// ── Upgrade Flash Effect ──
function UpgradeFlash({ level }: { level: number }) {
  return (
    <motion.div
      key={`flash-${level}`}
      className="absolute inset-0 rounded-sm pointer-events-none z-10"
      style={{ background: 'radial-gradient(circle, #00ffcc44, transparent)' }}
      initial={{ opacity: 1, scale: 1.3 }}
      animate={{ opacity: 0, scale: 1 }}
      transition={{ duration: 0.6 }}
    />
  );
}

// ── Building Indicators ──
function BuildingIndicators({ serverLevel }: { serverLevel: number }) {
  if (serverLevel === 0) return null;

  if (serverLevel === 5) {
    return (
      <div className="absolute top-[7px] left-1/2 -translate-x-1/2 z-[5]">
        <DatacenterIcon />
      </div>
    );
  }

  // 1-4 servers
  return (
    <div className="absolute top-[7px] left-1/2 -translate-x-1/2 flex gap-[1px] z-[5]">
      {Array.from({ length: serverLevel }, (_, i) => (
        <ServerIcon key={i} delay={i} />
      ))}
    </div>
  );
}

// ── Tile Component ──
interface TileProps {
  tile: TileData;
  players: { id: string; color: string; position_index: number; piece: string | null }[];
  isOwned: boolean;
  ownerColor?: string;
  serverLevel: number;
  onClick: () => void;
}

function Tile({ tile, players, isOwned, ownerColor, serverLevel, onClick }: TileProps) {
  const playersHere = players.filter((p) => p.position_index === tile.index);
  const corner = isCorner(tile.index);
  const colorHex = tile.colorGroup ? COLOR_MAP[tile.colorGroup as ColorGroup] : undefined;

  // Track level changes for flash effect
  const prevLevelRef = useRef(serverLevel);
  const showFlash = serverLevel > prevLevelRef.current;
  useEffect(() => {
    prevLevelRef.current = serverLevel;
  }, [serverLevel]);

  const hasBuildings = serverLevel > 0;

  return (
    <motion.div
      className={`
        relative border cursor-pointer
        flex flex-col items-center justify-center overflow-hidden
        transition-all duration-200
        ${corner ? 'w-[90px] h-[90px]' : 'w-[70px] h-[70px]'}
        hover:z-10 hover:scale-110 hover:border-cyan-400/60
        ${hasBuildings ? 'border-cyan-500/30' : 'border-cyan-900/30'}
      `}
      style={{
        background: isOwned
          ? `linear-gradient(135deg, ${ownerColor}22, ${ownerColor}44)`
          : 'rgba(10, 15, 30, 0.8)',
        backdropFilter: 'blur(4px)',
        ...(serverLevel === 5
          ? { boxShadow: `0 0 12px #00ffcc22, inset 0 0 8px #00ffcc11` }
          : {}),
      }}
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Neon flash on upgrade */}
      <AnimatePresence>
        {showFlash && <UpgradeFlash level={serverLevel} />}
      </AnimatePresence>

      {/* Color strip — glows more with higher level */}
      {colorHex && (
        <div
          className="absolute top-0 left-0 right-0 h-[6px] rounded-t-sm"
          style={{
            background: colorHex,
            boxShadow: hasBuildings ? `0 0 ${4 + serverLevel * 2}px ${colorHex}88` : 'none',
          }}
        />
      )}

      {/* Building indicators */}
      <BuildingIndicators serverLevel={serverLevel} />

      {/* Icon or Name — pushed down when buildings present */}
      <span
        className={`text-[10px] text-center leading-tight px-1 text-cyan-100/80 font-medium ${
          hasBuildings ? 'mt-4' : ''
        }`}
      >
        {tile.icon && <span className="text-sm block">{tile.icon}</span>}
        <span className="block mt-0.5 truncate max-w-[60px]">{tile.name}</span>
      </span>

      {/* Price */}
      {tile.price && !hasBuildings && (
        <span className="text-[8px] text-cyan-400/60 mt-0.5">${tile.price}</span>
      )}

      {/* Level badge for improved properties */}
      {hasBuildings && (
        <span className="absolute bottom-1 left-1 text-[7px] font-bold text-cyan-400/70 bg-cyan-900/40 px-1 rounded">
          {serverLevel === 5 ? 'DC' : `Lv${serverLevel}`}
        </span>
      )}

      {/* Ownership indicator */}
      {isOwned && ownerColor && (
        <div
          className="absolute bottom-1 right-1 w-2 h-2 rounded-full shadow-lg"
          style={{ background: ownerColor, boxShadow: `0 0 6px ${ownerColor}` }}
        />
      )}

      {/* Player tokens */}
      {playersHere.length > 0 && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {playersHere.map((p) => {
            const piece = PLAYER_PIECES.find((x) => x.id === p.piece);
            return piece ? (
              <motion.div
                key={p.id}
                className="w-4 h-4 flex items-center justify-center rounded-sm text-[9px] leading-none border"
                style={{
                  background: `${p.color}28`,
                  borderColor: `${p.color}80`,
                  boxShadow: `0 0 6px ${p.color}`,
                }}
                layoutId={`token-${p.id}`}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                {piece.emoji}
              </motion.div>
            ) : (
              <motion.div
                key={p.id}
                className="w-3 h-3 rounded-full border border-white/40 shadow-lg"
                style={{ background: p.color, boxShadow: `0 0 8px ${p.color}` }}
                layoutId={`token-${p.id}`}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ── Board Component ──
export default function GameBoard() {
  const { players, properties, setShowPropertyCard } = useGameStore();
  const { getDisplayPosition } = useSteppingAnimation(
    players.map((p) => ({ id: p.id, position_index: p.position_index })),
    300
  );

  const getOwnerInfo = (tileIndex: number) => {
    const prop = properties.find((p) => p.property_index === tileIndex);
    if (!prop?.owner_id) return { isOwned: false, serverLevel: 0 };
    const owner = players.find((p) => p.id === prop.owner_id);
    return { isOwned: true, ownerColor: owner?.color ?? '#666', serverLevel: prop.server_level };
  };

  return (
    <div className="relative">
      <div
        className="grid gap-0 mx-auto"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(11, auto)',
          gridTemplateRows: 'repeat(11, auto)',
          transform: 'perspective(1200px) rotateX(25deg) rotateZ(-5deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {Array.from({ length: 11 * 11 }, (_, i) => {
          const row = Math.floor(i / 11);
          const col = i % 11;

          const tile = BOARD_TILES.find((t) => {
            const pos = getTilePosition(t.index);
            return pos.row === row && pos.col === col;
          });

          if (!tile) {
            if (row >= 1 && row <= 9 && col >= 1 && col <= 9) {
              if (row === 5 && col === 5) {
                return (
                  <div key={i} className="w-[70px] h-[70px] flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                        MK
                      </div>
                      <div className="text-[8px] text-cyan-500/60 tracking-widest">POLIS</div>
                    </div>
                  </div>
                );
              }
              return <div key={i} className="w-[70px] h-[70px]" />;
            }
            return <div key={i} className="w-[70px] h-[70px]" />;
          }

          const { isOwned, ownerColor, serverLevel } = getOwnerInfo(tile.index);

          return (
            <div
              key={i}
              style={{ gridRow: row + 1, gridColumn: col + 1 }}
            >
              <Tile
                tile={tile}
                players={players.map((p) => ({
                  id: p.id,
                  color: p.color,
                  position_index: getDisplayPosition(p.id, p.position_index),
                  piece: p.piece,
                }))}
                isOwned={isOwned}
                ownerColor={ownerColor}
                serverLevel={serverLevel ?? 0}
                onClick={() => tile.price && setShowPropertyCard(tile.index)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

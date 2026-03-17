'use client';

import { motion } from 'framer-motion';
import { BOARD_TILES, COLOR_MAP, type TileData, type ColorGroup } from '@/data/board';
import { useGameStore } from '@/store/useGameStore';
import { useSteppingAnimation } from '@/hooks/useSteppingAnimation';

// Board layout: 11x11 grid, tiles along the edges
// Bottom: 0-10 (left to right), Left: 11-19 (bottom to top),
// Top: 20-30 (left to right), Right: 31-39 (top to bottom)

function getTilePosition(index: number): { row: number; col: number } {
  if (index <= 10) return { row: 10, col: 10 - index }; // Bottom row
  if (index <= 19) return { row: 10 - (index - 10), col: 0 }; // Left column
  if (index <= 30) return { row: 0, col: index - 20 }; // Top row
  return { row: index - 30, col: 10 }; // Right column
}

function isCorner(index: number): boolean {
  return [0, 10, 20, 30].includes(index);
}

interface TileProps {
  tile: TileData;
  players: { id: string; color: string; position_index: number }[];
  isOwned: boolean;
  ownerColor?: string;
  onClick: () => void;
}

function Tile({ tile, players, isOwned, ownerColor, onClick }: TileProps) {
  const playersHere = players.filter((p) => p.position_index === tile.index);
  const corner = isCorner(tile.index);
  const colorHex = tile.colorGroup ? COLOR_MAP[tile.colorGroup as ColorGroup] : undefined;

  return (
    <motion.div
      className={`
        relative border border-cyan-900/30 cursor-pointer
        flex flex-col items-center justify-center
        transition-all duration-200
        ${corner ? 'w-[90px] h-[90px]' : 'w-[70px] h-[70px]'}
        hover:z-10 hover:scale-110 hover:border-cyan-400/60
      `}
      style={{
        background: isOwned
          ? `linear-gradient(135deg, ${ownerColor}22, ${ownerColor}44)`
          : 'rgba(10, 15, 30, 0.8)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Color strip */}
      {colorHex && (
        <div
          className="absolute top-0 left-0 right-0 h-[6px] rounded-t-sm"
          style={{ background: colorHex }}
        />
      )}

      {/* Icon or Name */}
      <span className="text-[10px] text-center leading-tight px-1 text-cyan-100/80 font-medium">
        {tile.icon && <span className="text-sm block">{tile.icon}</span>}
        <span className="block mt-0.5 truncate max-w-[60px]">{tile.name}</span>
      </span>

      {/* Price */}
      {tile.price && (
        <span className="text-[8px] text-cyan-400/60 mt-0.5">${tile.price}</span>
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
          {playersHere.map((p) => (
            <motion.div
              key={p.id}
              className="w-3 h-3 rounded-full border border-white/40 shadow-lg"
              style={{
                background: p.color,
                boxShadow: `0 0 8px ${p.color}`,
              }}
              layoutId={`token-${p.id}`}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function GameBoard() {
  const { players, properties, setShowPropertyCard } = useGameStore();
  const { getDisplayPosition } = useSteppingAnimation(
    players.map((p) => ({ id: p.id, position_index: p.position_index })),
    300
  );

  const getOwnerInfo = (tileIndex: number) => {
    const prop = properties.find((p) => p.property_index === tileIndex);
    if (!prop?.owner_id) return { isOwned: false };
    const owner = players.find((p) => p.id === prop.owner_id);
    return { isOwned: true, ownerColor: owner?.color ?? '#666' };
  };

  return (
    <div className="relative">
      {/* Isometric wrapper */}
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
        {/* Render each cell of the 11x11 grid */}
        {Array.from({ length: 11 * 11 }, (_, i) => {
          const row = Math.floor(i / 11);
          const col = i % 11;

          // Find if there's a tile at this grid position
          const tile = BOARD_TILES.find((t) => {
            const pos = getTilePosition(t.index);
            return pos.row === row && pos.col === col;
          });

          if (!tile) {
            // Center area — empty or can show logo
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

          const { isOwned, ownerColor } = getOwnerInfo(tile.index);

          return (
            <div
              key={i}
              style={{
                gridRow: row + 1,
                gridColumn: col + 1,
              }}
            >
              <Tile
                tile={tile}
                players={players.map((p) => ({
                  id: p.id,
                  color: p.color,
                  position_index: getDisplayPosition(p.id, p.position_index),
                }))}
                isOwned={isOwned}
                ownerColor={ownerColor}
                onClick={() => tile.price && setShowPropertyCard(tile.index)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

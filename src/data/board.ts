// MKpolis Board — 40 tiles (standard Monopoly layout, gaming themed)

export type TileType =
  | 'go'
  | 'property'
  | 'power_card'   // Side Quest / Misión Secundaria
  | 'boss_fight'   // Boss Fight card
  | 'tax'
  | 'station'
  | 'utility'
  | 'jail'
  | 'free_parking'
  | 'go_to_jail';

export type ColorGroup =
  | 'blue'
  | 'green'
  | 'brown'
  | 'orange'
  | 'pink'
  | 'yellow'
  | 'gray_light'
  | 'gray_dark';

export interface TileData {
  index: number;
  name: string;
  type: TileType;
  colorGroup?: ColorGroup;
  price?: number;
  rent?: number[];        // rent by server_level [0..4]
  buildCost?: number;     // cost per server upgrade
  stationFee?: number;
  utilityMultiplier?: number;
  taxAmount?: number;
  icon?: string;
}

// Color map for rendering
export const COLOR_MAP: Record<ColorGroup, string> = {
  blue: '#1e3a5f',
  green: '#0f5132',
  brown: '#5c3d2e',
  orange: '#e65100',
  pink: '#ad1457',
  yellow: '#f9a825',
  gray_light: '#546e7a',
  gray_dark: '#37474f',
};

export const BOARD_TILES: TileData[] = [
  // ── BOTTOM ROW (0-10, right to left) ──
  { index: 0, name: 'SALIDA', type: 'go', icon: '🚀' },
  { index: 1, name: 'League of Legends', type: 'property', colorGroup: 'blue', price: 60, rent: [2, 10, 30, 90, 160, 250], buildCost: 50 },
  { index: 2, name: 'Misión Secundaria', type: 'power_card', icon: '⚡' },
  { index: 3, name: 'Dota 2', type: 'property', colorGroup: 'blue', price: 60, rent: [4, 20, 60, 180, 320, 450], buildCost: 50 },
  { index: 4, name: 'Impuesto de Ping', type: 'tax', taxAmount: 200, icon: '📡' },
  { index: 5, name: 'Estación Steam', type: 'station', price: 200, stationFee: 25, icon: '🎮' },
  { index: 6, name: 'Fortnite', type: 'property', colorGroup: 'green', price: 100, rent: [6, 30, 90, 270, 400, 550], buildCost: 50 },
  { index: 7, name: 'Boss Fight', type: 'boss_fight', icon: '👹' },
  { index: 8, name: 'PUBG', type: 'property', colorGroup: 'green', price: 100, rent: [6, 30, 90, 270, 400, 550], buildCost: 50 },
  { index: 9, name: 'Apex Legends', type: 'property', colorGroup: 'green', price: 120, rent: [8, 40, 100, 300, 450, 600], buildCost: 50 },
  { index: 10, name: 'CÁRCEL / LAG', type: 'jail', icon: '⏳' },

  // ── LEFT COLUMN (11-19, bottom to top) ──
  { index: 11, name: 'Minecraft', type: 'property', colorGroup: 'brown', price: 140, rent: [10, 50, 150, 450, 625, 750], buildCost: 100 },
  { index: 12, name: 'PC Master Race', type: 'utility', price: 150, utilityMultiplier: 4, icon: '🖥️' },
  { index: 13, name: 'Roblox', type: 'property', colorGroup: 'brown', price: 140, rent: [10, 50, 150, 450, 625, 750], buildCost: 100 },
  { index: 14, name: 'Terraria', type: 'property', colorGroup: 'brown', price: 160, rent: [12, 60, 180, 500, 700, 900], buildCost: 100 },
  { index: 15, name: 'Estación Epic', type: 'station', price: 200, stationFee: 25, icon: '🏪' },
  { index: 16, name: 'GTA V', type: 'property', colorGroup: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], buildCost: 100 },
  { index: 17, name: 'Misión Secundaria', type: 'power_card', icon: '⚡' },
  { index: 18, name: 'Red Dead Redemption 2', type: 'property', colorGroup: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], buildCost: 100 },
  { index: 19, name: 'Cyberpunk 2077', type: 'property', colorGroup: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], buildCost: 100 },

  // ── TOP ROW (20-30, left to right) ──
  { index: 20, name: 'Lounge de Servidor', type: 'free_parking', icon: '🅿️' },
  { index: 21, name: 'Elden Ring', type: 'property', colorGroup: 'pink', price: 220, rent: [18, 90, 250, 700, 875, 1050], buildCost: 150 },
  { index: 22, name: 'Boss Fight', type: 'boss_fight', icon: '👹' },
  { index: 23, name: 'Bloodborne', type: 'property', colorGroup: 'pink', price: 220, rent: [18, 90, 250, 700, 875, 1050], buildCost: 150 },
  { index: 24, name: 'Dark Souls', type: 'property', colorGroup: 'pink', price: 240, rent: [20, 100, 300, 750, 925, 1100], buildCost: 150 },
  { index: 25, name: 'Estación Nintendo', type: 'station', price: 200, stationFee: 25, icon: '🍄' },
  { index: 26, name: 'Zelda: BotW', type: 'property', colorGroup: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], buildCost: 150 },
  { index: 27, name: 'Mario Odyssey', type: 'property', colorGroup: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], buildCost: 150 },
  { index: 28, name: 'Fibra Óptica', type: 'utility', price: 150, utilityMultiplier: 4, icon: '🌐' },
  { index: 29, name: 'Animal Crossing', type: 'property', colorGroup: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], buildCost: 150 },

  // ── RIGHT COLUMN (30-39, top to bottom) ──
  { index: 30, name: 'VE AL LAG', type: 'go_to_jail', icon: '💀' },
  { index: 31, name: 'Valorant', type: 'property', colorGroup: 'gray_light', price: 300, rent: [26, 130, 390, 900, 1100, 1275], buildCost: 200 },
  { index: 32, name: 'CS:GO 2', type: 'property', colorGroup: 'gray_light', price: 300, rent: [26, 130, 390, 900, 1100, 1275], buildCost: 200 },
  { index: 33, name: 'Misión Secundaria', type: 'power_card', icon: '⚡' },
  { index: 34, name: 'Overwatch 2', type: 'property', colorGroup: 'gray_light', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], buildCost: 200 },
  { index: 35, name: 'Estación PSN', type: 'station', price: 200, stationFee: 25, icon: '🎯' },
  { index: 36, name: 'Boss Fight', type: 'boss_fight', icon: '👹' },
  { index: 37, name: 'God of War', type: 'property', colorGroup: 'gray_dark', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], buildCost: 200 },
  { index: 38, name: 'Impuesto de Loot Box', type: 'tax', taxAmount: 100, icon: '📦' },
  { index: 39, name: 'The Last of Us', type: 'property', colorGroup: 'gray_dark', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], buildCost: 200 },
];

// Helpers
export function getTile(index: number): TileData {
  return BOARD_TILES[index % 40];
}

export function getPropertiesInGroup(group: ColorGroup): TileData[] {
  return BOARD_TILES.filter((t) => t.colorGroup === group);
}

export function isPropertyTile(tile: TileData): boolean {
  return tile.type === 'property' || tile.type === 'station' || tile.type === 'utility';
}

export const PLAYER_COLORS = ['#00ffcc', '#ff3d71', '#ffaa00', '#7c4dff', '#00e676', '#ff6e40'];

export const PLAYER_PIECES = [
  { id: 'pawn',   emoji: '♟️', name: 'Peón'     },
  { id: 'crown',  emoji: '👑', name: 'Corona'   },
  { id: 'car',    emoji: '🚗', name: 'Coche'    },
  { id: 'hat',    emoji: '🎩', name: 'Sombrero' },
  { id: 'star',   emoji: '⭐', name: 'Estrella' },
  { id: 'sword',  emoji: '⚔️', name: 'Espada'   },
  { id: 'gem',    emoji: '💎', name: 'Gema'     },
  { id: 'rocket', emoji: '🚀', name: 'Cohete'   },
  { id: 'dragon', emoji: '🐉', name: 'Dragón'   },
  { id: 'shield', emoji: '🛡️', name: 'Escudo'   },
] as const;

export type PieceId = (typeof PLAYER_PIECES)[number]['id'];

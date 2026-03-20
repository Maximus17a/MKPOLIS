import type { GameRules } from '@/lib/database.types';
import { BOARD_TILES } from '@/data/board';
import type { ColorGroup } from '@/data/board';

export const DEFAULT_RULES: GameRules = {
  lounge_pot: false,
  jail_bankruptcy: false,
  win_color_line: false,
  win_monopoly_or_stations: false,
};

/** Safely parse rules from DB (handles null / partial objects) */
export function parseRules(raw: unknown): GameRules {
  const r = (raw ?? {}) as Partial<GameRules>;
  return {
    lounge_pot: r.lounge_pot ?? false,
    jail_bankruptcy: r.jail_bankruptcy ?? false,
    win_color_line: r.win_color_line ?? false,
    win_monopoly_or_stations: r.win_monopoly_or_stations ?? false,
  };
}

// Property indices grouped by color
const COLOR_GROUP_INDICES: Record<ColorGroup, number[]> = {
  blue:       [1, 3],
  green:      [6, 8, 9],
  brown:      [11, 13, 14],
  orange:     [16, 18, 19],
  pink:       [21, 23, 24],
  yellow:     [26, 27, 29],
  gray_light: [31, 32, 34],
  gray_dark:  [37, 39],
};

const STATION_INDICES = [5, 15, 25, 35];

/**
 * Returns the winning playerId if a property-based win condition is met,
 * or null otherwise.
 *
 * @param rules      Active game rules
 * @param playerIds  IDs of all non-bankrupt players
 * @param ownedByPlayer  Map of playerId → Set<property_index>
 */
export function checkPropertyWinner(
  rules: GameRules,
  playerIds: string[],
  ownedByPlayer: Map<string, Set<number>>
): string | null {
  if (!rules.win_color_line && !rules.win_monopoly_or_stations) return null;

  for (const playerId of playerIds) {
    const owned = ownedByPlayer.get(playerId) ?? new Set<number>();

    if (rules.win_color_line) {
      for (const indices of Object.values(COLOR_GROUP_INDICES)) {
        if (indices.every((i) => owned.has(i))) return playerId;
      }
    }

    if (rules.win_monopoly_or_stations) {
      // Check all 4 stations
      if (STATION_INDICES.every((i) => owned.has(i))) return playerId;

      // Check 3+ complete color monopolies
      let monopolies = 0;
      for (const indices of Object.values(COLOR_GROUP_INDICES)) {
        if (indices.every((i) => owned.has(i))) monopolies++;
      }
      if (monopolies >= 3) return playerId;
    }
  }

  return null;
}

/** Build a playerId → Set<property_index> map from a properties array */
export function buildOwnershipMap(
  properties: { owner_id: string | null; property_index: number }[]
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const p of properties) {
    if (!p.owner_id) continue;
    if (!map.has(p.owner_id)) map.set(p.owner_id, new Set());
    map.get(p.owner_id)!.add(p.property_index);
  }
  return map;
}

export { BOARD_TILES, COLOR_GROUP_INDICES, STATION_INDICES };

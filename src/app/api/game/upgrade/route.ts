import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';
import { BOARD_TILES, getPropertiesInGroup, type ColorGroup } from '@/data/board';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId, propertyIndex } = await req.json();
    const db = createServiceClient();

    const [{ data: game }, { data: player }] = await Promise.all([
      db.from('games').select('*').eq('id', gameId).single(),
      db.from('players').select('*').eq('id', playerId).single(),
    ]);

    if (!game || !player) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    if (game.current_turn_player_id !== playerId) {
      return Response.json({ error: 'Not your turn' }, { status: 403 });
    }
    if (game.turn_phase !== 'action') {
      return Response.json({ error: 'Cannot upgrade right now' }, { status: 400 });
    }

    const tile = BOARD_TILES[propertyIndex];
    if (!tile || tile.type !== 'property' || !tile.buildCost || !tile.colorGroup) {
      return Response.json({ error: 'Cannot upgrade this tile' }, { status: 400 });
    }

    // Get the property
    const { data: property } = await db
      .from('properties')
      .select('*')
      .eq('game_id', gameId)
      .eq('property_index', propertyIndex)
      .single();

    if (!property) {
      return Response.json({ error: 'Property not found' }, { status: 404 });
    }
    if (property.owner_id !== playerId) {
      return Response.json({ error: 'You do not own this property' }, { status: 403 });
    }
    if (property.server_level >= 5) {
      return Response.json({ error: 'Property already at max level' }, { status: 400 });
    }
    if (property.is_mortgaged) {
      return Response.json({ error: 'Cannot upgrade mortgaged property' }, { status: 400 });
    }

    // Check player owns ALL properties in the color group (monopoly requirement)
    const groupTiles = getPropertiesInGroup(tile.colorGroup as ColorGroup);
    const { data: groupProperties } = await db
      .from('properties')
      .select('*')
      .eq('game_id', gameId)
      .in(
        'property_index',
        groupTiles.map((t) => t.index)
      );

    const ownsAll = groupProperties?.every((p) => p.owner_id === playerId);
    if (!ownsAll) {
      return Response.json(
        { error: 'You must own all properties in this color group to upgrade' },
        { status: 400 }
      );
    }

    // Even building rule: no property in the group can be more than 1 level above any other
    const currentLevels = groupProperties!.map((p) =>
      p.property_index === propertyIndex ? property.server_level + 1 : p.server_level
    );
    const minLevel = Math.min(...currentLevels);
    const maxLevel = Math.max(...currentLevels);
    if (maxLevel - minLevel > 1) {
      return Response.json(
        { error: 'Must build evenly across the group' },
        { status: 400 }
      );
    }

    // Check funds
    if (player.balance < tile.buildCost) {
      return Response.json({ error: 'Insufficient funds' }, { status: 400 });
    }

    // OCC: Upgrade property
    await occUpdate(db, 'properties', property.id, property.version, {
      server_level: property.server_level + 1,
    });

    // OCC: Deduct balance
    await occUpdate(db, 'players', player.id, player.version, {
      balance: player.balance - tile.buildCost,
    });

    // Log
    await db.from('game_logs').insert({
      game_id: gameId,
      player_id: playerId,
      message: `Mejoró ${tile.name} a Servidor Lv.${property.server_level + 1} por $${tile.buildCost}`,
      action_type: 'upgrade',
    });

    return Response.json({
      success: true,
      property: tile.name,
      newLevel: property.server_level + 1,
      cost: tile.buildCost,
      newBalance: player.balance - tile.buildCost,
    });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('upgrade error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

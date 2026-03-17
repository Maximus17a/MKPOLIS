import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';
import { BOARD_TILES } from '@/data/board';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId, propertyIndex } = await req.json();
    const db = createServiceClient();

    const { data: player } = await db.from('players').select('*').eq('id', playerId).single();
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

    const tile = BOARD_TILES[propertyIndex];
    if (!tile || !tile.price) return Response.json({ error: 'Invalid property' }, { status: 400 });

    const { data: property } = await db
      .from('properties').select('*').eq('game_id', gameId).eq('property_index', propertyIndex).single();

    if (!property) return Response.json({ error: 'Property not found' }, { status: 404 });
    if (property.owner_id !== playerId) return Response.json({ error: 'Not your property' }, { status: 403 });
    if (property.server_level > 0) return Response.json({ error: 'Sell improvements first' }, { status: 400 });

    const sellValue = property.is_mortgaged ? 0 : Math.floor(tile.price / 2);

    // Remove ownership
    await occUpdate(db, 'properties', property.id, property.version, {
      owner_id: null,
      is_mortgaged: false,
      server_level: 0,
    });

    if (sellValue > 0) {
      await occUpdate(db, 'players', player.id, player.version, {
        balance: player.balance + sellValue,
      });
    }

    await db.from('game_logs').insert({
      game_id: gameId, player_id: playerId,
      message: `Vendió ${tile.name} al banco por $${sellValue}.`,
      action_type: 'sell',
    });

    return Response.json({ success: true, received: sellValue });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('sell error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

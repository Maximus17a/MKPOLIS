import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';
import { BOARD_TILES } from '@/data/board';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId } = await req.json();
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
      return Response.json({ error: 'Cannot buy right now' }, { status: 400 });
    }

    const tile = BOARD_TILES[player.position_index];
    if (!tile.price) {
      return Response.json({ error: 'This tile cannot be purchased' }, { status: 400 });
    }

    // Check if property exists and is unowned
    const { data: property } = await db
      .from('properties')
      .select('*')
      .eq('game_id', gameId)
      .eq('property_index', player.position_index)
      .single();

    if (!property) {
      return Response.json({ error: 'Property not found' }, { status: 404 });
    }
    if (property.owner_id) {
      return Response.json({ error: 'Property already owned' }, { status: 400 });
    }
    if (player.balance < tile.price) {
      return Response.json({ error: 'Insufficient funds' }, { status: 400 });
    }

    // OCC: Update property ownership
    await occUpdate(db, 'properties', property.id, property.version, {
      owner_id: playerId,
    });

    // OCC: Deduct balance
    await occUpdate(db, 'players', player.id, player.version, {
      balance: player.balance - tile.price,
    });

    // Log
    await db.from('game_logs').insert({
      game_id: gameId,
      player_id: playerId,
      message: `Compró ${tile.name} por ${tile.price} monedas.`,
      action_type: 'buy',
    });

    return Response.json({
      success: true,
      property: tile.name,
      cost: tile.price,
      newBalance: player.balance - tile.price,
    });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('buy error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

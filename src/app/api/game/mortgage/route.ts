import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';
import { BOARD_TILES } from '@/data/board';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId, propertyIndex, action } = await req.json();
    // action: 'mortgage' | 'unmortgage'
    const db = createServiceClient();

    const [{ data: game }, { data: player }] = await Promise.all([
      db.from('games').select('*').eq('id', gameId).single(),
      db.from('players').select('*').eq('id', playerId).single(),
    ]);

    if (!game || !player) return Response.json({ error: 'Not found' }, { status: 404 });

    const tile = BOARD_TILES[propertyIndex];
    if (!tile || !tile.price) return Response.json({ error: 'Invalid property' }, { status: 400 });

    const { data: property } = await db
      .from('properties').select('*').eq('game_id', gameId).eq('property_index', propertyIndex).single();

    if (!property) return Response.json({ error: 'Property not found' }, { status: 404 });
    if (property.owner_id !== playerId) return Response.json({ error: 'Not your property' }, { status: 403 });

    if (action === 'mortgage') {
      if (property.is_mortgaged) return Response.json({ error: 'Already mortgaged' }, { status: 400 });
      if (property.server_level > 0) return Response.json({ error: 'Sell improvements first' }, { status: 400 });

      const mortgageValue = Math.floor(tile.price / 2);

      await occUpdate(db, 'properties', property.id, property.version, { is_mortgaged: true });
      await occUpdate(db, 'players', player.id, player.version, { balance: player.balance + mortgageValue });

      await db.from('game_logs').insert({
        game_id: gameId, player_id: playerId,
        message: `Hipotecó ${tile.name} por $${mortgageValue}.`,
        action_type: 'mortgage',
      });

      return Response.json({ success: true, received: mortgageValue, newBalance: player.balance + mortgageValue });

    } else if (action === 'unmortgage') {
      if (!property.is_mortgaged) return Response.json({ error: 'Not mortgaged' }, { status: 400 });

      const unmortgageCost = Math.floor(tile.price / 2 * 1.1); // 50% + 10% interest

      if (player.balance < unmortgageCost) {
        return Response.json({ error: 'Insufficient funds' }, { status: 400 });
      }

      await occUpdate(db, 'properties', property.id, property.version, { is_mortgaged: false });
      await occUpdate(db, 'players', player.id, player.version, { balance: player.balance - unmortgageCost });

      await db.from('game_logs').insert({
        game_id: gameId, player_id: playerId,
        message: `Deshipotecó ${tile.name} pagando $${unmortgageCost}.`,
        action_type: 'mortgage',
      });

      return Response.json({ success: true, paid: unmortgageCost, newBalance: player.balance - unmortgageCost });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('mortgage error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

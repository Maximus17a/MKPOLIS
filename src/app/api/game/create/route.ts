import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { BOARD_TILES } from '@/data/board';

export async function POST(req: NextRequest) {
  try {
    const { hostUserId } = await req.json();
    const db = createServiceClient();

    // Create game
    const { data: game, error: gameErr } = await db
      .from('games')
      .insert({ host_id: hostUserId })
      .select()
      .single();

    if (gameErr || !game) {
      return Response.json({ error: 'Failed to create game', details: gameErr?.message }, { status: 500 });
    }

    // Create host as first player
    const { data: player, error: playerErr } = await db
      .from('players')
      .insert({
        game_id: game.id,
        user_id: hostUserId,
        turn_order: 0,
        color: '#00ffcc',
      })
      .select()
      .single();

    if (playerErr) {
      return Response.json({ error: 'Failed to add host as player', details: playerErr.message }, { status: 500 });
    }

    // Initialize all purchasable properties
    const propertyInserts = BOARD_TILES
      .filter((t) => t.price !== undefined)
      .map((t) => ({
        game_id: game.id,
        property_index: t.index,
      }));

    await db.from('properties').insert(propertyInserts);

    // Log
    await db.from('game_logs').insert({
      game_id: game.id,
      player_id: player.id,
      message: 'Partida creada. Esperando jugadores...',
      action_type: 'create',
    });

    return Response.json({ gameId: game.id, playerId: player.id });
  } catch (err) {
    console.error('create error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

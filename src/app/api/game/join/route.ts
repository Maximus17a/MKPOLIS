import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { PLAYER_COLORS } from '@/data/board';

export async function POST(req: NextRequest) {
  try {
    const { gameId, userId } = await req.json();
    const db = createServiceClient();

    const { data: game } = await db.from('games').select('*').eq('id', gameId).single();
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });
    if (game.status !== 'waiting') return Response.json({ error: 'Game already started' }, { status: 400 });

    // Check player count
    const { data: existingPlayers } = await db
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .order('turn_order');

    if (!existingPlayers) return Response.json({ error: 'Failed to fetch players' }, { status: 500 });
    if (existingPlayers.length >= 6) return Response.json({ error: 'Game is full (max 6)' }, { status: 400 });
    if (existingPlayers.some((p) => p.user_id === userId)) {
      return Response.json({ error: 'Already in this game' }, { status: 400 });
    }

    const turnOrder = existingPlayers.length;
    const color = PLAYER_COLORS[turnOrder % PLAYER_COLORS.length];

    const { data: player, error } = await db
      .from('players')
      .insert({ game_id: gameId, user_id: userId, turn_order: turnOrder, color })
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    await db.from('game_logs').insert({
      game_id: gameId,
      player_id: player.id,
      message: 'Se unió a la partida.',
      action_type: 'join',
    });

    return Response.json({ playerId: player.id, turnOrder, color });
  } catch (err) {
    console.error('join error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

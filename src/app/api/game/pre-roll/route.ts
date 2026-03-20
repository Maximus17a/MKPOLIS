import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId } = await req.json();
    const db = createServiceClient();

    const { data: game } = await db.from('games').select('status').eq('id', gameId).single();
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });
    if (game.status !== 'pre_roll') return Response.json({ error: 'Not in pre-roll phase' }, { status: 400 });

    const { data: player } = await db
      .from('players')
      .select('pre_roll_result')
      .eq('id', playerId)
      .single();
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });
    if (player.pre_roll_result !== null) return Response.json({ error: 'Already rolled' }, { status: 400 });

    const result = Math.floor(Math.random() * 6) + 1;
    await db.from('players').update({ pre_roll_result: result }).eq('id', playerId);

    await db.from('game_logs').insert({
      game_id: gameId,
      player_id: playerId,
      message: `sacó ${result} en el dado de orden.`,
      action_type: 'pre_roll',
    });

    return Response.json({ result });
  } catch (err) {
    console.error('pre-roll error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

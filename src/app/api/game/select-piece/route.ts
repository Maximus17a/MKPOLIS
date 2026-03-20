import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId, piece } = await req.json();
    const db = createServiceClient();

    const { data: game } = await db.from('games').select('status').eq('id', gameId).single();
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });
    if (game.status !== 'waiting') return Response.json({ error: 'Cannot change piece after rolling phase starts' }, { status: 400 });

    // Check if piece is taken by another player
    const { data: taken } = await db
      .from('players')
      .select('id')
      .eq('game_id', gameId)
      .eq('piece', piece)
      .neq('id', playerId)
      .maybeSingle();

    if (taken) return Response.json({ error: 'Piece already taken' }, { status: 409 });

    await db.from('players').update({ piece }).eq('id', playerId);

    return Response.json({ success: true });
  } catch (err) {
    console.error('select-piece error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

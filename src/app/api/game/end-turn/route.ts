import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId } = await req.json();
    const db = createServiceClient();

    const { data: game } = await db.from('games').select('*').eq('id', gameId).single();
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });
    if (game.current_turn_player_id !== playerId) {
      return Response.json({ error: 'Not your turn' }, { status: 403 });
    }

    const { data: activePlayers } = await db
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .eq('is_bankrupt', false)
      .order('turn_order');

    if (!activePlayers || activePlayers.length === 0) {
      return Response.json({ error: 'No active players' }, { status: 400 });
    }

    const currentIdx = activePlayers.findIndex((p) => p.id === playerId);
    const nextIdx = (currentIdx + 1) % activePlayers.length;

    await occUpdate(db, 'games', game.id, game.version, {
      current_turn_player_id: activePlayers[nextIdx].id,
      turn_phase: 'roll',
    });

    await db.from('game_logs').insert({
      game_id: gameId,
      player_id: playerId,
      message: 'Terminó su turno.',
      action_type: 'end_turn',
    });

    return Response.json({ success: true, nextPlayer: activePlayers[nextIdx].id });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('end-turn error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

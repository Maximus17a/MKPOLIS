import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';

export async function POST(req: NextRequest) {
  try {
    const { gameId, hostUserId } = await req.json();
    const db = createServiceClient();

    const { data: game } = await db.from('games').select('*').eq('id', gameId).single();
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });
    if (game.host_id !== hostUserId) return Response.json({ error: 'Only host can start' }, { status: 403 });
    if (game.status !== 'pre_roll') return Response.json({ error: 'Game must be in pre-roll phase' }, { status: 400 });

    const { data: players } = await db
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .order('turn_order');

    if (!players || players.length < 2) {
      return Response.json({ error: 'Need at least 2 players' }, { status: 400 });
    }

    if (players.some((p) => p.pre_roll_result === null || p.pre_roll_result === undefined)) {
      return Response.json({ error: 'All players must roll first' }, { status: 400 });
    }

    // Sort by pre_roll_result DESC; ties broken by original turn_order ASC
    const sorted = [...players].sort((a, b) => {
      const diff = (b.pre_roll_result ?? 0) - (a.pre_roll_result ?? 0);
      return diff !== 0 ? diff : a.turn_order - b.turn_order;
    });

    // Reassign turn_order based on roll results
    await Promise.all(
      sorted.map((p, i) => db.from('players').update({ turn_order: i }).eq('id', p.id))
    );

    await occUpdate(db, 'games', game.id, game.version, {
      status: 'in_progress',
      current_turn_player_id: sorted[0].id,
      turn_phase: 'roll',
    });

    await db.from('game_logs').insert({
      game_id: gameId,
      player_id: sorted[0].id,
      message: `¡La partida ha comenzado! Empieza con ${sorted[0].pre_roll_result} en el dado.`,
      action_type: 'start',
    });

    return Response.json({ success: true, firstPlayer: sorted[0].id });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('start error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';

// Called by any connected player when the current player has been inactive too long.
export async function POST(req: NextRequest) {
  try {
    const { gameId, callerId } = await req.json();
    const db = createServiceClient();

    const { data: game } = await db.from('games').select('*').eq('id', gameId).single();
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });
    if (game.status !== 'in_progress') return Response.json({ error: 'Game not in progress' }, { status: 400 });

    // Caller must be an active player in this game (not the one being skipped)
    const { data: caller } = await db
      .from('players')
      .select('id')
      .eq('game_id', gameId)
      .eq('id', callerId)
      .eq('is_bankrupt', false)
      .single();
    if (!caller) return Response.json({ error: 'Caller not found in game' }, { status: 403 });
    if (game.current_turn_player_id === callerId) {
      return Response.json({ error: 'Cannot skip your own turn' }, { status: 400 });
    }

    // Only skip during roll phase (action phase auto-ends via the existing timer)
    if (game.turn_phase !== 'roll') {
      return Response.json({ error: 'Not in roll phase' }, { status: 400 });
    }

    const skippedPlayerId = game.current_turn_player_id;

    // Advance to next active player
    const { data: activePlayers } = await db
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .eq('is_bankrupt', false)
      .order('turn_order');

    if (!activePlayers || activePlayers.length < 2) {
      return Response.json({ error: 'Not enough players' }, { status: 400 });
    }

    const currentIdx = activePlayers.findIndex((p) => p.id === skippedPlayerId);
    const nextIdx = (currentIdx + 1) % activePlayers.length;

    await occUpdate(db, 'games', game.id, game.version, {
      current_turn_player_id: activePlayers[nextIdx].id,
      turn_phase: 'roll',
    });

    await db.from('game_logs').insert({
      game_id: gameId,
      player_id: skippedPlayerId ?? callerId,
      message: '⏭️ Turno saltado por inactividad.',
      action_type: 'end_turn',
    });

    return Response.json({ success: true, nextPlayer: activePlayers[nextIdx].id });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('skip-turn error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

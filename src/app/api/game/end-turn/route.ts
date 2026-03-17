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

    // ── Evaluate quest_valorant_clutch progress ──
    const { data: player } = await db.from('players').select('*').eq('id', playerId).single();
    if (player?.active_quest_id === 'quest_valorant_clutch') {
      const newProgress = player.quest_progress - 1;
      if (newProgress <= 0) {
        // Quest completed!
        await occUpdate(db, 'players', player.id, player.version, {
          active_quest_id: null,
          quest_progress: 0,
          balance: player.balance + 400,
        });
        await db.from('game_logs').insert({
          game_id: gameId,
          player_id: playerId,
          message: '¡Quest "Clutch en Valorant" completada! Ganas $400.',
          action_type: 'power_card',
        });
      } else {
        await occUpdate(db, 'players', player.id, player.version, {
          quest_progress: newProgress,
        });
        await db.from('game_logs').insert({
          game_id: gameId,
          player_id: playerId,
          message: `Quest "Clutch en Valorant": ${newProgress} turno(s) restante(s).`,
          action_type: 'power_card',
        });
      }
    }

    // ── Advance to next player ──
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

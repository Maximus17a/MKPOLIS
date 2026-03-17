import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';
import { BOARD_TILES } from '@/data/board';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId, rentAmount, ownerId } = await req.json();
    const db = createServiceClient();

    const { data: player } = await db.from('players').select('*').eq('id', playerId).single();
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

    const { data: game } = await db.from('games').select('*').eq('id', gameId).single();
    if (!game || game.current_turn_player_id !== playerId) {
      return Response.json({ error: 'Not your turn' }, { status: 403 });
    }

    if (player.balance < rentAmount) {
      return Response.json({ error: 'Insufficient funds. Mortgage or sell properties first.' }, { status: 400 });
    }

    // Deduct from player
    await occUpdate(db, 'players', player.id, player.version, {
      balance: player.balance - rentAmount,
    });

    // Pay to owner
    const { data: owner } = await db.from('players').select('*').eq('id', ownerId).single();
    if (owner) {
      await occUpdate(db, 'players', owner.id, owner.version, {
        balance: owner.balance + rentAmount,
      });
    }

    const tile = BOARD_TILES[player.position_index];
    await db.from('game_logs').insert({
      game_id: gameId,
      player_id: playerId,
      message: `Pagó $${rentAmount} de alquiler en ${tile?.name ?? 'propiedad'}.`,
      action_type: 'rent',
    });

    // Check if quest_valorant_clutch fails (paid rent)
    const { data: freshPlayer } = await db.from('players').select('*').eq('id', playerId).single();
    if (freshPlayer?.active_quest_id === 'quest_valorant_clutch') {
      await occUpdate(db, 'players', freshPlayer.id, freshPlayer.version, {
        active_quest_id: null,
        quest_progress: 0,
        balance: freshPlayer.balance - 100,
      });
      await db.from('game_logs').insert({
        game_id: gameId,
        player_id: playerId,
        message: 'Quest "Clutch en Valorant" fallida! (pagó renta) -$100.',
        action_type: 'power_card',
      });
    }

    // Check bankruptcy
    const { data: afterPay } = await db.from('players').select('*').eq('id', playerId).single();
    if (afterPay && afterPay.balance < 0) {
      return Response.json({ success: true, rentPaid: rentAmount, balanceNegative: true });
    }

    return Response.json({ success: true, rentPaid: rentAmount, newBalance: afterPay?.balance ?? 0 });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('pay-rent error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

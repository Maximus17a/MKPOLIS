import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId, creditorId } = await req.json();
    // creditorId: the player owed money to, or null if owed to bank
    const db = createServiceClient();

    const { data: player } = await db.from('players').select('*').eq('id', playerId).single();
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });
    if (player.is_bankrupt) return Response.json({ error: 'Already bankrupt' }, { status: 400 });

    // Transfer all properties to creditor (or release to bank)
    const { data: myProps } = await db
      .from('properties').select('*').eq('game_id', gameId).eq('owner_id', playerId);

    for (const prop of myProps ?? []) {
      if (creditorId) {
        // Transfer to creditor
        await occUpdate(db, 'properties', prop.id, prop.version, {
          owner_id: creditorId,
          is_mortgaged: prop.is_mortgaged, // creditor inherits mortgaged state
        });
      } else {
        // Return to bank
        await occUpdate(db, 'properties', prop.id, prop.version, {
          owner_id: null,
          server_level: 0,
          is_mortgaged: false,
        });
      }
    }

    // Transfer remaining cash to creditor
    if (creditorId && player.balance > 0) {
      const { data: creditor } = await db.from('players').select('*').eq('id', creditorId).single();
      if (creditor) {
        await occUpdate(db, 'players', creditor.id, creditor.version, {
          balance: creditor.balance + player.balance,
        });
      }
    }

    // Mark player as bankrupt
    await occUpdate(db, 'players', player.id, player.version, {
      is_bankrupt: true,
      balance: 0,
      active_quest_id: null,
      quest_progress: 0,
    });

    await db.from('game_logs').insert({
      game_id: gameId, player_id: playerId,
      message: '💀 ¡BANCARROTA! Ha sido eliminado de la partida.',
      action_type: 'bankrupt',
    });

    // Check if game is over (1 or fewer active players)
    const { data: activePlayers } = await db
      .from('players').select('*').eq('game_id', gameId).eq('is_bankrupt', false);

    if (activePlayers && activePlayers.length <= 1) {
      const { data: game } = await db.from('games').select('*').eq('id', gameId).single();
      if (game) {
        await occUpdate(db, 'games', game.id, game.version, { status: 'finished' });
        const winner = activePlayers[0];
        if (winner) {
          await db.from('game_logs').insert({
            game_id: gameId, player_id: winner.id,
            message: `🏆 ¡${winner.id} gana la partida!`,
            action_type: 'game_over',
          });
        }
      }
      return Response.json({ success: true, gameOver: true, winnerId: activePlayers[0]?.id });
    }

    // Advance turn if it was the bankrupt player's turn
    const { data: game } = await db.from('games').select('*').eq('id', gameId).single();
    if (game?.current_turn_player_id === playerId && activePlayers && activePlayers.length > 0) {
      const sorted = activePlayers.sort((a, b) => a.turn_order - b.turn_order);
      const currentIdx = sorted.findIndex((p) => p.turn_order > player.turn_order);
      const nextPlayer = sorted[currentIdx >= 0 ? currentIdx : 0];
      await occUpdate(db, 'games', game.id, game.version, {
        current_turn_player_id: nextPlayer.id,
        turn_phase: 'roll',
      });
    }

    return Response.json({ success: true, gameOver: false });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('bankrupt error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

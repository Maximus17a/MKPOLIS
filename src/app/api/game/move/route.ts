import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';
import { BOARD_TILES } from '@/data/board';

/**
 * POST /api/game/move
 * End turn action: pay rent if applicable, then advance to next player.
 */
export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId } = await req.json();
    const db = createServiceClient();

    const [{ data: game }, { data: player }] = await Promise.all([
      db.from('games').select('*').eq('id', gameId).single(),
      db.from('players').select('*').eq('id', playerId).single(),
    ]);

    if (!game || !player) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    if (game.current_turn_player_id !== playerId) {
      return Response.json({ error: 'Not your turn' }, { status: 403 });
    }

    const tile = BOARD_TILES[player.position_index];
    let rentPaid = 0;

    // Handle rent payment for owned properties
    if (tile.type === 'property' || tile.type === 'station' || tile.type === 'utility') {
      const { data: property } = await db
        .from('properties')
        .select('*')
        .eq('game_id', gameId)
        .eq('property_index', player.position_index)
        .single();

      if (property?.owner_id && property.owner_id !== playerId && !property.is_mortgaged) {
        const rent = calculateRent(tile, property, db, gameId);
        const resolvedRent = await rent;

        if (resolvedRent > 0) {
          // Pay rent
          await occUpdate(db, 'players', player.id, player.version, {
            balance: player.balance - resolvedRent,
          });

          // Owner receives rent
          const { data: owner } = await db.from('players').select('*').eq('id', property.owner_id).single();
          if (owner) {
            await occUpdate(db, 'players', owner.id, owner.version, {
              balance: owner.balance + resolvedRent,
            });
          }

          rentPaid = resolvedRent;

          await db.from('game_logs').insert({
            game_id: gameId,
            player_id: playerId,
            message: `Pagó ${resolvedRent} de alquiler en ${tile.name}.`,
            action_type: 'rent',
          });
        }
      }
    }

    // Check bankruptcy
    const { data: freshPlayer } = await db.from('players').select('*').eq('id', playerId).single();
    if (freshPlayer && freshPlayer.balance < 0) {
      await occUpdate(db, 'players', freshPlayer.id, freshPlayer.version, {
        is_bankrupt: true,
      });
      await db.from('game_logs').insert({
        game_id: gameId,
        player_id: playerId,
        message: '¡BANCARROTA! Ha sido eliminado.',
        action_type: 'bankrupt',
      });
    }

    // Advance turn
    const { data: activePlayers } = await db
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .eq('is_bankrupt', false)
      .order('turn_order');

    if (!activePlayers || activePlayers.length <= 1) {
      // Game over
      const { data: latestGame } = await db.from('games').select('*').eq('id', gameId).single();
      if (latestGame) {
        await occUpdate(db, 'games', latestGame.id, latestGame.version, { status: 'finished' });
      }
      const winner = activePlayers?.[0];
      await db.from('game_logs').insert({
        game_id: gameId,
        player_id: winner?.id ?? null,
        message: winner ? `¡${winner.id} gana la partida!` : 'Partida terminada.',
        action_type: 'game_over',
      });
      return Response.json({ gameOver: true, winnerId: winner?.id });
    }

    const currentIdx = activePlayers.findIndex((p) => p.id === playerId);
    const nextIdx = (currentIdx + 1) % activePlayers.length;

    const { data: latestGame } = await db.from('games').select('*').eq('id', gameId).single();
    if (latestGame) {
      await occUpdate(db, 'games', latestGame.id, latestGame.version, {
        current_turn_player_id: activePlayers[nextIdx].id,
        turn_phase: 'roll',
      });
    }

    return Response.json({ success: true, rentPaid, nextPlayer: activePlayers[nextIdx].id });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('move error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function calculateRent(
  tile: (typeof BOARD_TILES)[number],
  property: { server_level: number; owner_id: string | null; game_id: string },
  db: ReturnType<typeof createServiceClient>,
  gameId: string
): Promise<number> {
  if (tile.type === 'station' && tile.stationFee) {
    // Count owner's stations
    const { count } = await db
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .eq('owner_id', property.owner_id!)
      .in('property_index', [5, 15, 25, 35]);
    const stationCount = count ?? 1;
    return tile.stationFee * stationCount;
  }

  if (tile.type === 'utility' && tile.utilityMultiplier) {
    // Utilities: multiplier * dice roll (use 7 as average)
    const { count } = await db
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .eq('owner_id', property.owner_id!)
      .in('property_index', [12, 28]);
    const utilCount = count ?? 1;
    const multiplier = utilCount >= 2 ? 10 : 4;
    return multiplier * 7; // Average dice roll
  }

  if (tile.rent && tile.rent.length > property.server_level) {
    return tile.rent[property.server_level];
  }

  return 0;
}

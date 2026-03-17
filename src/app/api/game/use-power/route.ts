import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId, cardId, targetPlayerId, targetPosition } = await req.json();
    const db = createServiceClient();

    // Fetch card
    const { data: card } = await db
      .from('player_cards')
      .select('*')
      .eq('id', cardId)
      .eq('player_id', playerId)
      .eq('is_used', false)
      .single();

    if (!card) {
      return Response.json({ error: 'Card not found or already used' }, { status: 404 });
    }

    const { data: player } = await db.from('players').select('*').eq('id', playerId).single();
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

    let logMsg = '';

    switch (card.card_type) {
      case 'stun': {
        if (!targetPlayerId) return Response.json({ error: 'Target required' }, { status: 400 });
        const { data: target } = await db.from('players').select('*').eq('id', targetPlayerId).single();
        if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

        await occUpdate(db, 'players', target.id, target.version, {
          stun_turns_remaining: target.stun_turns_remaining + 1,
        });
        logMsg = `Usó Stun sobre otro jugador. ¡1 turno paralizado!`;
        break;
      }

      case 'respawn': {
        const pos = targetPosition ?? 0; // Default: go to SALIDA
        if (pos < 0 || pos > 39) return Response.json({ error: 'Invalid position' }, { status: 400 });

        // If in jail, escape
        const updates: Record<string, number> = { position_index: pos };
        if (player.jail_turns_remaining > 0) {
          updates.jail_turns_remaining = 0;
        }

        await occUpdate(db, 'players', player.id, player.version, updates);
        logMsg = `Usó Respawn/TP → casilla ${pos}.${player.jail_turns_remaining > 0 ? ' ¡Escapó del LAG!' : ''}`;
        break;
      }

      case 'loot_drop': {
        // Instant 200 coins
        await occUpdate(db, 'players', player.id, player.version, {
          balance: player.balance + 200,
        });
        logMsg = `Usó Loot Drop → +200 monedas.`;
        break;
      }

      case 'gankeo': {
        if (!targetPlayerId) return Response.json({ error: 'Target required' }, { status: 400 });
        const { data: target } = await db.from('players').select('*').eq('id', targetPlayerId).single();
        if (!target) return Response.json({ error: 'Target not found' }, { status: 404 });

        const stolen = Math.floor(target.balance * 0.1);
        await occUpdate(db, 'players', target.id, target.version, {
          balance: target.balance - stolen,
        });
        // Refetch player for fresh version
        const { data: freshPlayer } = await db.from('players').select('*').eq('id', playerId).single();
        if (freshPlayer) {
          await occUpdate(db, 'players', freshPlayer.id, freshPlayer.version, {
            balance: freshPlayer.balance + stolen,
          });
        }
        logMsg = `Usó Gankeo → robó ${stolen} monedas a otro jugador.`;
        break;
      }

      default:
        return Response.json({ error: 'Unknown card type' }, { status: 400 });
    }

    // Mark card as used
    await db.from('player_cards').update({ is_used: true }).eq('id', cardId);

    // Log action
    await db.from('game_logs').insert({
      game_id: gameId,
      player_id: playerId,
      message: logMsg,
      action_type: 'power_card',
    });

    return Response.json({ success: true, cardType: card.card_type, message: logMsg });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('use-power error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

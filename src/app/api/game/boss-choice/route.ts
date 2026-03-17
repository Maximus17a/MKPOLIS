import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';

// POST /api/game/boss-choice
// Handles boss_botlane_duo choice: pay $300 or go to jail
export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId, choice } = await req.json();
    // choice: 'pay' | 'jail'
    const db = createServiceClient();

    const { data: player } = await db.from('players').select('*').eq('id', playerId).single();
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

    if (choice === 'pay') {
      const cost = Math.min(300, player.balance);
      await occUpdate(db, 'players', player.id, player.version, {
        balance: player.balance - cost,
      });
      await db.from('game_logs').insert({
        game_id: gameId, player_id: playerId,
        message: `Pagó $${cost} como tributo al Dúo Dinámico.`,
        action_type: 'boss_fight',
      });
      return Response.json({ success: true, paid: cost });

    } else if (choice === 'jail') {
      await occUpdate(db, 'players', player.id, player.version, {
        position_index: 10,
        jail_turns_remaining: 3,
      });
      await db.from('game_logs').insert({
        game_id: gameId, player_id: playerId,
        message: 'Fue al LAG por fedear contra el Dúo Dinámico.',
        action_type: 'boss_fight',
      });
      return Response.json({ success: true, jailed: true });
    }

    return Response.json({ error: 'Invalid choice' }, { status: 400 });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('boss-choice error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

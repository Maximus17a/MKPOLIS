import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';

export async function POST(req: NextRequest) {
  try {
    const { gameId, hostUserId } = await req.json();
    const db = createServiceClient();

    const { data: game } = await db.from('games').select('*').eq('id', gameId).single();
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });
    if (game.host_id !== hostUserId) return Response.json({ error: 'Only host can begin rolling' }, { status: 403 });
    if (game.status !== 'waiting') return Response.json({ error: 'Game not in waiting state' }, { status: 400 });

    const { data: players } = await db.from('players').select('id').eq('game_id', gameId);
    if (!players || players.length < 2) return Response.json({ error: 'Need at least 2 players' }, { status: 400 });

    await occUpdate(db, 'games', game.id, game.version, { status: 'pre_roll' });

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('begin-roll error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import type { GameRules } from '@/lib/database.types';
import { parseRules } from '@/lib/game/rules';

export async function POST(req: NextRequest) {
  try {
    const { gameId, rules }: { gameId: string; rules: GameRules } = await req.json();
    const db = createServiceClient();

    const { data: game } = await db.from('games').select('id, host_id, status').eq('id', gameId).single();
    if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });
    if (game.status !== 'waiting') {
      return Response.json({ error: 'Rules can only be changed before the game starts' }, { status: 400 });
    }

    const safe = parseRules(rules);

    const { error } = await db.from('games').update({ rules: safe }).eq('id', gameId);
    if (error) throw error;

    return Response.json({ success: true, rules: safe });
  } catch (err) {
    console.error('rules error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

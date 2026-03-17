import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { gameId, senderId, receiverId, offeredMoney, requestedMoney, offeredProperties, requestedProperties } = await req.json();
    const db = createServiceClient();

    // Validate sender and receiver exist
    const [{ data: sender }, { data: receiver }] = await Promise.all([
      db.from('players').select('*').eq('id', senderId).single(),
      db.from('players').select('*').eq('id', receiverId).single(),
    ]);

    if (!sender || !receiver) return Response.json({ error: 'Players not found' }, { status: 404 });
    if (sender.is_bankrupt || receiver.is_bankrupt) return Response.json({ error: 'Bankrupt player' }, { status: 400 });

    // Validate sender has the offered money
    if ((offeredMoney ?? 0) > sender.balance) {
      return Response.json({ error: 'Insufficient funds for offer' }, { status: 400 });
    }

    // Validate sender owns offered properties
    for (const propIdx of offeredProperties ?? []) {
      const { data: prop } = await db.from('properties').select('owner_id').eq('game_id', gameId).eq('property_index', propIdx).single();
      if (prop?.owner_id !== senderId) return Response.json({ error: `You don't own property ${propIdx}` }, { status: 400 });
    }

    // Validate receiver owns requested properties
    for (const propIdx of requestedProperties ?? []) {
      const { data: prop } = await db.from('properties').select('owner_id').eq('game_id', gameId).eq('property_index', propIdx).single();
      if (prop?.owner_id !== receiverId) return Response.json({ error: `Receiver doesn't own property ${propIdx}` }, { status: 400 });
    }

    // Cancel any existing pending offers from this sender
    await db.from('trade_offers').update({ status: 'cancelled' })
      .eq('sender_id', senderId).eq('status', 'pending');

    // Create offer
    const { data: offer, error } = await db.from('trade_offers').insert({
      game_id: gameId,
      sender_id: senderId,
      receiver_id: receiverId,
      offered_money: offeredMoney ?? 0,
      requested_money: requestedMoney ?? 0,
      offered_properties: offeredProperties ?? [],
      requested_properties: requestedProperties ?? [],
    }).select().single();

    if (error) throw error;

    await db.from('game_logs').insert({
      game_id: gameId, player_id: senderId,
      message: 'Envió una oferta de intercambio.',
      action_type: 'trade',
    });

    return Response.json({ success: true, offerId: offer.id });
  } catch (err) {
    console.error('trade offer error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

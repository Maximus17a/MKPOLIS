import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';

export async function POST(req: NextRequest) {
  try {
    const { offerId, playerId, accept } = await req.json();
    const db = createServiceClient();

    const { data: offer } = await db.from('trade_offers').select('*').eq('id', offerId).single();
    if (!offer) return Response.json({ error: 'Offer not found' }, { status: 404 });
    if (offer.receiver_id !== playerId) return Response.json({ error: 'Not your offer to respond to' }, { status: 403 });
    if (offer.status !== 'pending') return Response.json({ error: 'Offer no longer pending' }, { status: 400 });

    if (!accept) {
      await db.from('trade_offers').update({ status: 'rejected' }).eq('id', offerId);
      await db.from('game_logs').insert({
        game_id: offer.game_id, player_id: playerId,
        message: 'Rechazó la oferta de intercambio.',
        action_type: 'trade',
      });
      return Response.json({ success: true, rejected: true });
    }

    // Accept — execute the trade atomically
    const [{ data: sender }, { data: receiver }] = await Promise.all([
      db.from('players').select('*').eq('id', offer.sender_id).single(),
      db.from('players').select('*').eq('id', offer.receiver_id).single(),
    ]);

    if (!sender || !receiver) return Response.json({ error: 'Players not found' }, { status: 404 });

    // Validate funds
    if (sender.balance < offer.offered_money) return Response.json({ error: 'Sender has insufficient funds' }, { status: 400 });
    if (receiver.balance < offer.requested_money) return Response.json({ error: 'Receiver has insufficient funds' }, { status: 400 });

    // Transfer money
    const senderNewBal = sender.balance - offer.offered_money + offer.requested_money;
    const receiverNewBal = receiver.balance - offer.requested_money + offer.offered_money;

    await occUpdate(db, 'players', sender.id, sender.version, { balance: senderNewBal });
    await occUpdate(db, 'players', receiver.id, receiver.version, { balance: receiverNewBal });

    // Transfer properties: sender → receiver
    for (const propIdx of offer.offered_properties) {
      const { data: prop } = await db.from('properties').select('*')
        .eq('game_id', offer.game_id).eq('property_index', propIdx).single();
      if (prop && prop.owner_id === sender.id) {
        await occUpdate(db, 'properties', prop.id, prop.version, { owner_id: receiver.id });
      }
    }

    // Transfer properties: receiver → sender
    for (const propIdx of offer.requested_properties) {
      const { data: prop } = await db.from('properties').select('*')
        .eq('game_id', offer.game_id).eq('property_index', propIdx).single();
      if (prop && prop.owner_id === receiver.id) {
        await occUpdate(db, 'properties', prop.id, prop.version, { owner_id: sender.id });
      }
    }

    // Mark offer as accepted
    await db.from('trade_offers').update({ status: 'accepted' }).eq('id', offerId);

    await db.from('game_logs').insert({
      game_id: offer.game_id, player_id: playerId,
      message: '🤝 Intercambio completado exitosamente.',
      action_type: 'trade',
    });

    return Response.json({ success: true, accepted: true });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('trade respond error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

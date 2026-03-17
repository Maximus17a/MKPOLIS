import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';
import { BOARD_TILES } from '@/data/board';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId, doublesCount = 0 } = await req.json();
    const db = createServiceClient();

    // Fetch current state
    const [{ data: game }, { data: player }] = await Promise.all([
      db.from('games').select('*').eq('id', gameId).single(),
      db.from('players').select('*').eq('id', playerId).single(),
    ]);

    if (!game || !player) {
      return Response.json({ error: 'Game or player not found' }, { status: 404 });
    }

    if (game.current_turn_player_id !== playerId) {
      return Response.json({ error: 'Not your turn' }, { status: 403 });
    }

    if (game.turn_phase !== 'roll') {
      return Response.json({ error: 'Already rolled this turn' }, { status: 400 });
    }

    // Check stun
    if (player.stun_turns_remaining > 0) {
      await occUpdate(db, 'players', player.id, player.version, {
        stun_turns_remaining: player.stun_turns_remaining - 1,
      });
      await advanceTurn(db, game);
      await logAction(db, gameId, playerId, 'Esta stunneado. Pierde el turno.', 'stun');
      return Response.json({ stunned: true, turnsLeft: player.stun_turns_remaining - 1, doublesCount: 0 });
    }

    // Check jail
    if (player.jail_turns_remaining > 0) {
      const dice1 = randomDie();
      const dice2 = randomDie();
      const isDoubles = dice1 === dice2;

      if (isDoubles) {
        await occUpdate(db, 'players', player.id, player.version, {
          jail_turns_remaining: 0,
        });
        await logAction(db, gameId, playerId, `Saco dobles (${dice1}+${dice2})! Sale del LAG.`, 'jail_escape');
        // Jail escape does NOT count toward triple doubles, and no re-roll
        // Set phase to action so they can act but don't re-roll
        await occUpdate(db, 'games', game.id, game.version, { turn_phase: 'action' });
        return Response.json({ dice: [dice1, dice2], jailEscape: true, doublesCount: 0 });
      } else {
        const newJail = player.jail_turns_remaining - 1;
        if (newJail <= 0) {
          await occUpdate(db, 'players', player.id, player.version, {
            jail_turns_remaining: 0,
            balance: player.balance - 50,
          });
          await advanceTurn(db, game);
          await logAction(db, gameId, playerId, 'Sale del LAG pagando 50 monedas.', 'jail_pay');
          return Response.json({ dice: [dice1, dice2], jailPaid: true, doublesCount: 0 });
        } else {
          await occUpdate(db, 'players', player.id, player.version, {
            jail_turns_remaining: newJail,
          });
          await advanceTurn(db, game);
          await logAction(db, gameId, playerId, `Sigue en el LAG (${newJail} turnos restantes).`, 'jail');
          return Response.json({ dice: [dice1, dice2], inJail: true, turnsLeft: newJail, doublesCount: 0 });
        }
      }
    }

    // Roll dice
    const dice1 = randomDie();
    const dice2 = randomDie();
    const isDoubles = dice1 === dice2;
    const newDoublesCount = isDoubles ? doublesCount + 1 : 0;
    const total = dice1 + dice2;

    // Triple doubles → go to jail!
    if (newDoublesCount >= 3) {
      await occUpdate(db, 'players', player.id, player.version, {
        position_index: 10,
        jail_turns_remaining: 3,
      });
      await occUpdate(db, 'games', game.id, game.version, { turn_phase: 'action' });
      await logAction(db, gameId, playerId, `Tiro dobles 3 veces seguidas (${dice1}+${dice2})! Enviado al LAG!`, 'jail');

      return Response.json({
        dice: [dice1, dice2],
        tripleDoubles: true,
        newPosition: 10,
        doublesCount: 0,
      });
    }

    // Normal move
    const oldPos = player.position_index;
    const newPos = (oldPos + total) % 40;
    const passedGo = newPos < oldPos;
    const goBonus = passedGo ? 200 : 0;
    const newBalance = player.balance + goBonus;

    await occUpdate(db, 'players', player.id, player.version, {
      position_index: newPos,
      balance: newBalance,
    });

    // If doubles: stay in roll phase so player can roll again
    // If not doubles: move to action phase
    await occUpdate(db, 'games', game.id, game.version, {
      turn_phase: isDoubles ? 'roll' : 'action',
    });

    // Check tile effects
    const tile = BOARD_TILES[newPos];
    let landingEffect = '';

    if (tile.type === 'go_to_jail') {
      const { data: freshPlayer } = await db.from('players').select('*').eq('id', playerId).single();
      if (freshPlayer) {
        await occUpdate(db, 'players', freshPlayer.id, freshPlayer.version, {
          position_index: 10,
          jail_turns_remaining: 3,
        });
      }
      landingEffect = 'Enviado al LAG!';
    } else if (tile.type === 'tax' && tile.taxAmount) {
      const { data: freshPlayer } = await db.from('players').select('*').eq('id', playerId).single();
      if (freshPlayer) {
        await occUpdate(db, 'players', freshPlayer.id, freshPlayer.version, {
          balance: freshPlayer.balance - tile.taxAmount,
        });
      }
      landingEffect = `Paga impuesto: -${tile.taxAmount}`;
    } else if (tile.type === 'power_card') {
      landingEffect = await drawPowerCard(db, gameId, playerId);
    }

    const doublesMsg = isDoubles ? ' DOBLES! Tira de nuevo.' : '';
    const logMsg = `Tiro ${dice1}+${dice2}=${total}. Avanza a ${tile.name}.${passedGo ? ' (+200 por pasar SALIDA)' : ''}${landingEffect ? ' ' + landingEffect : ''}${doublesMsg}`;
    await logAction(db, gameId, playerId, logMsg, 'roll');

    return Response.json({
      dice: [dice1, dice2],
      isDoubles,
      doublesCount: newDoublesCount,
      newPosition: newPos,
      newBalance,
      passedGo,
      landingEffect,
      tile: tile.name,
    });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('roll-dice error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

function randomDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

async function advanceTurn(db: ReturnType<typeof createServiceClient>, game: { id: string; version: number; current_turn_player_id: string | null }) {
  const { data: players } = await db
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .eq('is_bankrupt', false)
    .order('turn_order');

  if (!players || players.length === 0) return;

  const currentIdx = players.findIndex((p) => p.id === game.current_turn_player_id);
  const nextIdx = (currentIdx + 1) % players.length;

  const { data: freshGame } = await db.from('games').select('*').eq('id', game.id).single();
  if (freshGame) {
    await occUpdate(db, 'games', freshGame.id, freshGame.version, {
      current_turn_player_id: players[nextIdx].id,
      turn_phase: 'roll',
    });
  }
}

async function drawPowerCard(db: ReturnType<typeof createServiceClient>, gameId: string, playerId: string): Promise<string> {
  const cardTypes = ['stun', 'respawn', 'loot_drop', 'gankeo'] as const;
  const drawn = cardTypes[Math.floor(Math.random() * cardTypes.length)];

  await db.from('player_cards').insert({
    game_id: gameId,
    player_id: playerId,
    card_type: drawn,
  });

  const names: Record<string, string> = {
    stun: 'Stun/Iniciacion',
    respawn: 'Respawn/TP',
    loot_drop: 'Loot Drop',
    gankeo: 'Gankeo',
  };

  return `Obtiene carta: ${names[drawn]}`;
}

async function logAction(db: ReturnType<typeof createServiceClient>, gameId: string, playerId: string, message: string, actionType: string) {
  await db.from('game_logs').insert({ game_id: gameId, player_id: playerId, message, action_type: actionType });
}

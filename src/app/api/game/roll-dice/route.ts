import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { occUpdate, ConflictError, conflictResponse } from '@/lib/occ';
import { BOARD_TILES } from '@/data/board';
import {
  randomSideQuest,
  randomBossFight,
  type GameEvent,
} from '@/lib/game/events-data';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerId, doublesCount = 0, dicePrediction } = await req.json();
    const db = createServiceClient();

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

    // ── Check stun ──
    if (player.stun_turns_remaining > 0) {
      await occUpdate(db, 'players', player.id, player.version, {
        stun_turns_remaining: player.stun_turns_remaining - 1,
      });
      await advanceTurn(db, game);
      await log(db, gameId, playerId, 'Está stunneado. Pierde el turno.', 'stun');
      return Response.json({ stunned: true, turnsLeft: player.stun_turns_remaining - 1, doublesCount: 0 });
    }

    // ── Check jail ──
    if (player.jail_turns_remaining > 0) {
      const dice1 = randomDie();
      const dice2 = randomDie();
      const isDoubles = dice1 === dice2;

      if (isDoubles) {
        await occUpdate(db, 'players', player.id, player.version, { jail_turns_remaining: 0 });
        await occUpdate(db, 'games', game.id, game.version, { turn_phase: 'action' });
        await log(db, gameId, playerId, `Sacó dobles (${dice1}+${dice2})! Sale del LAG.`, 'jail_escape');
        return Response.json({ dice: [dice1, dice2], jailEscape: true, doublesCount: 0 });
      } else {
        const newJail = player.jail_turns_remaining - 1;
        if (newJail <= 0) {
          await occUpdate(db, 'players', player.id, player.version, {
            jail_turns_remaining: 0,
            balance: player.balance - 50,
          });
          await advanceTurn(db, game);
          await log(db, gameId, playerId, 'Sale del LAG pagando $50.', 'jail_pay');
          return Response.json({ dice: [dice1, dice2], jailPaid: true, doublesCount: 0 });
        } else {
          await occUpdate(db, 'players', player.id, player.version, { jail_turns_remaining: newJail });
          await advanceTurn(db, game);
          await log(db, gameId, playerId, `Sigue en el LAG (${newJail} turnos restantes).`, 'jail');
          return Response.json({ dice: [dice1, dice2], inJail: true, turnsLeft: newJail, doublesCount: 0 });
        }
      }
    }

    // ── Roll dice ──
    const dice1 = randomDie();
    const dice2 = randomDie();
    const isDoubles = dice1 === dice2;
    const newDoublesCount = isDoubles ? doublesCount + 1 : 0;
    const total = dice1 + dice2;

    // ── Triple doubles → jail ──
    if (newDoublesCount >= 3) {
      await occUpdate(db, 'players', player.id, player.version, {
        position_index: 10,
        jail_turns_remaining: 3,
      });
      await occUpdate(db, 'games', game.id, game.version, { turn_phase: 'action' });
      await log(db, gameId, playerId, `Dobles 3 veces seguidas (${dice1}+${dice2})! Enviado al LAG!`, 'jail');
      return Response.json({ dice: [dice1, dice2], tripleDoubles: true, newPosition: 10, doublesCount: 0 });
    }

    // ── Check quest_skull_king prediction ──
    let skullKingCorrect = false;
    let skullKingBonus = 0;
    if (player.active_quest_id === 'quest_skull_king') {
      const isEven = total % 2 === 0;
      skullKingCorrect = (dicePrediction === 'even' && isEven) || (dicePrediction === 'odd' && !isEven);
      if (skullKingCorrect) {
        skullKingBonus = 200;
        await log(db, gameId, playerId, `💀 Rey Calavera: ¡ADIVINASTE! (${dicePrediction === 'even' ? 'Par' : 'Impar'}, salió ${total}). ¡Avanzas a SALIDA +$200!`, 'power_card');
      } else {
        skullKingBonus = -100;
        await log(db, gameId, playerId, `💀 Rey Calavera: Fallaste (apostaste ${dicePrediction === 'even' ? 'Par' : 'Impar'}, salió ${total}). -$100.`, 'power_card');
      }
      await db.from('players').update({ active_quest_id: null, quest_progress: 0 }).eq('id', playerId);
    }

    // ── Check quest_pentakill before moving ──
    let pentakillResult: null | { won: boolean; stolen: number } = null;
    if (player.active_quest_id === 'quest_pentakill') {
      const { data: freshPlayer } = await db.from('players').select('*').eq('id', playerId).single();
      if (freshPlayer) {
        if (total >= 8) {
          // Rob $50 from each other player
          const { data: others } = await db
            .from('players')
            .select('*')
            .eq('game_id', gameId)
            .eq('is_bankrupt', false)
            .neq('id', playerId);
          let stolen = 0;
          for (const other of others ?? []) {
            const take = Math.min(50, other.balance);
            await occUpdate(db, 'players', other.id, other.version, { balance: other.balance - take });
            const latest = await db.from('players').select('version, balance').eq('id', playerId).single();
            if (latest.data) {
              await db.from('players').update({ balance: latest.data.balance + take, version: latest.data.version + 1 })
                .eq('id', playerId).eq('version', latest.data.version);
            }
            stolen += take;
          }
          pentakillResult = { won: true, stolen };
          await log(db, gameId, playerId, `¡PENTAKILL! Robó $50 a cada jugador (total: $${stolen}).`, 'power_card');
        } else {
          // Consolation $50 from bank
          await db.from('players').update({ balance: freshPlayer.balance + 50, version: freshPlayer.version + 1 })
            .eq('id', playerId).eq('version', freshPlayer.version);
          pentakillResult = { won: false, stolen: 0 };
          await log(db, gameId, playerId, 'Falló el Pentakill. Recibe $50 de consolación del banco.', 'power_card');
        }
        // Clear quest
        await db.from('players').update({ active_quest_id: null, quest_progress: 0 })
          .eq('id', playerId);
      }
    }

    // ── Normal move ──
    const oldPos = player.position_index;
    // skull_king correct: override to SALIDA (0); wrong: normal move
    const newPos = skullKingCorrect ? 0 : (oldPos + total) % 40;
    const passedGo = skullKingCorrect ? (oldPos > 0) : (newPos < oldPos || (oldPos === 0 && total > 0));
    let goBonus = (passedGo ? 200 : 0) + skullKingBonus;

    // ── quest_save_rexy: reward on passing GO ──
    let saveRexyReward = 0;
    const { data: freshForQuest } = await db.from('players').select('*').eq('id', playerId).single();
    if (freshForQuest?.active_quest_id === 'quest_save_rexy' && passedGo) {
      saveRexyReward = 300;
      goBonus += 300;
      await db.from('players').update({ active_quest_id: null, quest_progress: 0 }).eq('id', playerId);
      await log(db, gameId, playerId, '¡Completó "Rescatar a Rexy"! Recibe $300.', 'power_card');
    }

    // Re-fetch fresh player to get latest balance/version after pentakill adjustments
    const { data: latestPlayer } = await db.from('players').select('*').eq('id', playerId).single();
    if (!latestPlayer) throw new Error('Player not found after adjustments');

    await occUpdate(db, 'players', latestPlayer.id, latestPlayer.version, {
      position_index: newPos,
      balance: latestPlayer.balance + goBonus,
    });

    // Set turn phase
    await occUpdate(db, 'games', game.id, game.version, {
      turn_phase: isDoubles ? 'roll' : 'action',
    });

    // ── Tile effects ──
    const tile = BOARD_TILES[newPos];
    let landingEffect = '';
    let drawnEvent: GameEvent | null = null;

    if (tile.type === 'go_to_jail') {
      const { data: fp } = await db.from('players').select('*').eq('id', playerId).single();
      if (fp) {
        // quest_valorant_clutch fails on jail
        const questFail = fp.active_quest_id === 'quest_valorant_clutch';
        await occUpdate(db, 'players', fp.id, fp.version, {
          position_index: 10,
          jail_turns_remaining: 3,
          ...(questFail ? { active_quest_id: null, quest_progress: 0, balance: fp.balance - 100 } : {}),
        });
        if (questFail) await log(db, gameId, playerId, 'Quest "Clutch en Valorant" fallida! (fue al LAG) -$100.', 'power_card');
      }
      landingEffect = 'Enviado al LAG!';

    } else if (tile.type === 'tax' && tile.taxAmount) {
      const { data: fp } = await db.from('players').select('*').eq('id', playerId).single();
      if (fp) {
        await occUpdate(db, 'players', fp.id, fp.version, { balance: fp.balance - tile.taxAmount });
      }
      landingEffect = `Paga impuesto: -$${tile.taxAmount}`;

    } else if (tile.type === 'power_card') {
      // Side Quest / Misión Secundaria
      const { data: fp } = await db.from('players').select('*').eq('id', playerId).single();
      if (fp && !fp.active_quest_id) {
        drawnEvent = randomSideQuest();
        const quest = drawnEvent as import('@/lib/game/events-data').SideQuest;

        // Handle quests with immediate movement effects
        if (quest.id === 'quest_speedrun_luis') {
          // Move to Steam Station (tile 5)
          const steamPos = 5;
          const passedGoOnSpeedrun = fp.position_index > steamPos;
          const speedrunBonus = passedGoOnSpeedrun ? 200 : 0;
          await occUpdate(db, 'players', fp.id, fp.version, {
            position_index: steamPos,
            balance: fp.balance + speedrunBonus,
          });
          landingEffect = `Speedrun! Avanza a Estación Steam.${passedGoOnSpeedrun ? ' (+$200 por SALIDA)' : ''}`;
        } else if (quest.id === 'quest_zenith_blade') {
          // Roll single die and advance, ignoring rent
          const singleDie = Math.floor(Math.random() * 6) + 1;
          const zenithPos = (fp.position_index + singleDie) % 40;
          const passedGoZenith = zenithPos < fp.position_index;
          const zenithBonus = passedGoZenith ? 200 : 0;
          await occUpdate(db, 'players', fp.id, fp.version, {
            position_index: zenithPos,
            balance: fp.balance + zenithBonus,
          });
          const zenithTile = BOARD_TILES[zenithPos];
          landingEffect = `Espada del Cénit! Dado: ${singleDie}. Avanza a ${zenithTile.name} (sin alquiler).`;
        } else {
          // Standard quest assignment
          const updates: Record<string, unknown> = {
            active_quest_id: quest.id,
            quest_progress: quest.progressTurns,
          };
          if (quest.immediateCost) {
            updates.balance = fp.balance - quest.immediateCost;
          }
          await occUpdate(db, 'players', fp.id, fp.version, updates);
          landingEffect = `Misión asignada: ${quest.title}`;
        }
      } else {
        landingEffect = 'Ya tienes una misión activa.';
      }

    } else if (tile.type === 'boss_fight') {
      // Boss Fight — resolve immediately
      const { data: fp } = await db.from('players').select('*').eq('id', playerId).single();
      if (fp) {
        drawnEvent = randomBossFight();
        const boss = drawnEvent as import('@/lib/game/events-data').BossFight;
        landingEffect = await resolveBoss(db, gameId, playerId, fp, boss.id);
      }
    }

    // ── Check if rent is owed on landing tile ──
    let rentOwed: { amount: number; ownerId: string; ownerName: string; tileName: string } | null = null;
    if (
      (tile.type === 'property' || tile.type === 'station' || tile.type === 'utility') &&
      !landingEffect.startsWith('GLADOS_DOUBLE_RENT')
    ) {
      const { data: landProp } = await db
        .from('properties').select('*').eq('game_id', gameId).eq('property_index', newPos).single();
      if (landProp?.owner_id && landProp.owner_id !== playerId && !landProp.is_mortgaged) {
        const rentAmount = await calculateRent(tile, landProp, db, gameId);
        if (rentAmount > 0) {
          rentOwed = {
            amount: rentAmount,
            ownerId: landProp.owner_id,
            ownerName: landProp.owner_id, // frontend resolves name from store
            tileName: tile.name,
          };
        }
      }
    }

    // Check GLaDOS double rent
    if (landingEffect.startsWith('GLADOS_DOUBLE_RENT:')) {
      const retroPos = parseInt(landingEffect.split(':')[1]);
      const retroTile = BOARD_TILES[retroPos];
      const { data: retroProp } = await db
        .from('properties').select('*').eq('game_id', gameId).eq('property_index', retroPos).single();
      if (retroProp?.owner_id && retroProp.owner_id !== playerId && !retroProp.is_mortgaged) {
        const baseRent = await calculateRent(retroTile, retroProp, db, gameId);
        rentOwed = {
          amount: baseRent * 2,
          ownerId: retroProp.owner_id,
          ownerName: retroProp.owner_id,
          tileName: retroTile.name,
        };
      }
      landingEffect = `GLaDOS! Retrocedes a ${BOARD_TILES[retroPos]?.name}. ¡DOBLE alquiler!`;
    }

    const doublesMsg = isDoubles ? ' DOBLES! Tira de nuevo.' : '';
    const logMsg = `Tiró ${dice1}+${dice2}=${total}. Avanza a ${tile.name}.${passedGo ? ' (+200 por SALIDA)' : ''}${saveRexyReward ? ` (+300 Rexy)` : ''}${landingEffect ? ' ' + landingEffect : ''}${doublesMsg}`;

    // Broadcast drawn event to all players via a dedicated log so others can show spectator modal
    if (drawnEvent) {
      await log(db, gameId, playerId, drawnEvent.id, 'event_shown');
    }

    await log(db, gameId, playerId, logMsg, 'roll');

    return Response.json({
      dice: [dice1, dice2],
      isDoubles,
      doublesCount: newDoublesCount,
      newPosition: newPos,
      passedGo,
      landingEffect,
      tile: tile.name,
      event: drawnEvent,
      pentakillResult,
      rentOwed,
    });
  } catch (err) {
    if (err instanceof ConflictError) return conflictResponse();
    console.error('roll-dice error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── Boss fight resolver ──
async function resolveBoss(
  db: ReturnType<typeof createServiceClient>,
  gameId: string,
  playerId: string,
  player: { id: string; version: number; balance: number; stun_turns_remaining: number; active_quest_id: string | null; boss_immunity: boolean },
  bossId: string
): Promise<string> {

  if (bossId === 'boss_radahn_meteor') {
    // All players lose $200, active player also stunned
    const { data: allPlayers } = await db.from('players').select('*').eq('game_id', gameId).eq('is_bankrupt', false);
    for (const p of allPlayers ?? []) {
      const newBal = Math.max(0, p.balance - 200);
      const extra = p.id === playerId ? { stun_turns_remaining: p.stun_turns_remaining + 1 } : {};
      await occUpdate(db, 'players', p.id, p.version, { balance: newBal, ...extra });
    }
    await log(db, gameId, playerId, '☄️ Radahn golpea a TODOS (-$200). Quedas aturdido.', 'boss_fight');
    return 'Radahn! Todos pierden $200. Pierdes tu próximo turno.';

  } else if (bossId === 'boss_sephiroth_supernova') {
    // Pay 20% of total value (cash + base property values)
    const { data: ownedProps } = await db
      .from('properties').select('property_index').eq('game_id', gameId).eq('owner_id', playerId);
    const propValue = (ownedProps ?? []).reduce((sum, p) => {
      const tile = BOARD_TILES[p.property_index];
      return sum + (tile?.price ?? 0);
    }, 0);
    const totalValue = player.balance + propValue;
    const penalty = Math.floor(totalValue * 0.2);
    await occUpdate(db, 'players', player.id, player.version, { balance: Math.max(0, player.balance - penalty) });
    await log(db, gameId, playerId, `🌟 Supernova de Sephiroth! Pagas $${penalty} (20% de valor total).`, 'boss_fight');
    return `Supernova! Pagas $${penalty}.`;

  } else if (bossId === 'boss_bowser_theft') {
    const { data: myProps } = await db
      .from('properties').select('*').eq('game_id', gameId).eq('owner_id', playerId);
    const unimproved = (myProps ?? []).filter((p) => p.server_level === 0 && !p.is_mortgaged);

    if (unimproved.length === 0) {
      // No properties — pay $100
      await occUpdate(db, 'players', player.id, player.version, { balance: Math.max(0, player.balance - 100) });
      await log(db, gameId, playerId, '🐢 Bowser no encontró propiedades. Te cobra $100.', 'boss_fight');
      return 'Bowser frustrado. Pagas $100.';
    }

    // Pick random unimproved property
    const stolen = unimproved[Math.floor(Math.random() * unimproved.length)];

    // Pick random opponent
    const { data: opponents } = await db
      .from('players').select('*').eq('game_id', gameId).eq('is_bankrupt', false).neq('id', playerId);
    if (!opponents || opponents.length === 0) {
      await log(db, gameId, playerId, '🐢 Bowser no encontró rivales a quien dar la propiedad.', 'boss_fight');
      return 'Bowser no encontró rivales.';
    }
    const recipient = opponents[Math.floor(Math.random() * opponents.length)];

    await occUpdate(db, 'properties', stolen.id, stolen.version, { owner_id: recipient.id });
    const tileName = BOARD_TILES[stolen.property_index]?.name ?? 'propiedad';
    await log(db, gameId, playerId, `🐢 Bowser robó ${tileName} y la entregó a otro jugador!`, 'boss_fight');
    return `Bowser robó ${tileName}!`;

  } else if (bossId === 'boss_botlane_duo') {
    // This boss requires a player choice — handled via boss-choice API
    // Just return that the modal needs to be shown; the frontend will call /api/game/boss-choice
    await log(db, gameId, playerId, '👥 El Dúo Dinámico aparece. Elige: pagar $300 o ir al LAG.', 'boss_fight');
    return 'BOSS_CHOICE:boss_botlane_duo';

  } else if (bossId === 'boss_creeper') {
    // Find the property with highest server_level
    const { data: myProps } = await db
      .from('properties').select('*').eq('game_id', gameId).eq('owner_id', playerId);
    const improved = (myProps ?? []).filter((p) => p.server_level > 0);

    if (improved.length === 0) {
      // No improvements — lose 50% of cash
      const penalty = Math.floor(player.balance / 2);
      await occUpdate(db, 'players', player.id, player.version, { balance: player.balance - penalty });
      await log(db, gameId, playerId, `💥 Creeper! Sin mejoras. Pierdes $${penalty} (50% de tu efectivo).`, 'boss_fight');
      return `Creeper! Pierdes $${penalty}.`;
    }

    // Pick the one with highest level
    improved.sort((a, b) => b.server_level - a.server_level);
    const target = improved[0];
    const targetTile = BOARD_TILES[target.property_index]?.name ?? 'propiedad';
    await occUpdate(db, 'properties', target.id, target.version, { server_level: 0 });
    await log(db, gameId, playerId, `💥 Creeper destruyó las mejoras de ${targetTile} (Lv.${target.server_level}→0)!`, 'boss_fight');
    return `Creeper destruyó ${targetTile}!`;

  } else if (bossId === 'boss_glados') {
    // Retrocede 3 casillas
    const { data: fpGlados } = await db.from('players').select('*').eq('id', playerId).single();
    if (fpGlados) {
      const retroPos = (fpGlados.position_index - 3 + 40) % 40;
      await occUpdate(db, 'players', fpGlados.id, fpGlados.version, { position_index: retroPos });

      // Check if landing on owned property → double rent (handled as a flag in response)
      const retroTile = BOARD_TILES[retroPos];
      const { data: retroProp } = await db.from('properties').select('*').eq('game_id', gameId).eq('property_index', retroPos).single();

      if (retroProp?.owner_id && retroProp.owner_id !== playerId && !retroProp.is_mortgaged) {
        await log(db, gameId, playerId, `🤖 GLaDOS te hace retroceder 3 casillas a ${retroTile?.name}. ¡Pagarás DOBLE alquiler!`, 'boss_fight');
        return `GLADOS_DOUBLE_RENT:${retroPos}`;
      }

      await log(db, gameId, playerId, `🤖 GLaDOS te hace retroceder 3 casillas a ${retroTile?.name}.`, 'boss_fight');
      return `GLaDOS! Retrocedes a ${retroTile?.name}.`;
    }
    return 'GLaDOS te hace retroceder.';
  }

  return '';
}

async function calculateRent(
  tile: (typeof BOARD_TILES)[number],
  property: { server_level: number; owner_id: string | null; game_id: string },
  db: ReturnType<typeof createServiceClient>,
  gameId: string
): Promise<number> {
  if (tile.type === 'station' && tile.stationFee) {
    const { count } = await db
      .from('properties').select('*', { count: 'exact', head: true })
      .eq('game_id', gameId).eq('owner_id', property.owner_id!)
      .in('property_index', [5, 15, 25, 35]);
    return tile.stationFee * (count ?? 1);
  }
  if (tile.type === 'utility' && tile.utilityMultiplier) {
    const { count } = await db
      .from('properties').select('*', { count: 'exact', head: true })
      .eq('game_id', gameId).eq('owner_id', property.owner_id!)
      .in('property_index', [12, 28]);
    const multiplier = (count ?? 1) >= 2 ? 10 : 4;
    return multiplier * 7;
  }
  if (tile.rent && tile.rent.length > property.server_level) {
    return tile.rent[property.server_level];
  }
  return 0;
}

function randomDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

async function advanceTurn(
  db: ReturnType<typeof createServiceClient>,
  game: { id: string; version: number; current_turn_player_id: string | null }
) {
  const { data: players } = await db
    .from('players').select('*').eq('game_id', game.id).eq('is_bankrupt', false).order('turn_order');
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

async function log(
  db: ReturnType<typeof createServiceClient>,
  gameId: string,
  playerId: string,
  message: string,
  actionType: string
) {
  await db.from('game_logs').insert({ game_id: gameId, player_id: playerId, message, action_type: actionType });
}

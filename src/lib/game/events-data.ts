// Static catalog of game events: Side Quests and Boss Fights

export interface SideQuest {
  id: string;
  type: 'side_quest';
  title: string;
  description: string;
  icon: string;
  rewardAmount: number;
  penaltyAmount: number;
  progressTurns: number; // how many turns to track (0 = resolves on next roll)
  immediateCost?: number; // deducted right when drawn
}

export interface BossFight {
  id: string;
  type: 'boss_fight';
  title: string;
  description: string;
  icon: string;
}

export type GameEvent = SideQuest | BossFight;

export const SIDE_QUESTS: SideQuest[] = [
  {
    id: 'quest_valorant_clutch',
    type: 'side_quest',
    title: 'Clutch en Valorant: 1vX',
    description:
      'Eres el último en pie con la Spike plantada y escuchas pasos por todos lados. Sobrevive tus próximos 2 turnos sin caer en el LAG ni pagarle alquiler a ningún otro jugador. Recompensa: $400. Penalización por fallo: $100.',
    icon: '🎯',
    rewardAmount: 400,
    penaltyAmount: 100,
    progressTurns: 2,
  },
  {
    id: 'quest_pentakill',
    type: 'side_quest',
    title: '¡Pentakill en la Grieta!',
    description:
      'Has armado la jugada perfecta. En tu PRÓXIMO lanzamiento de dados: si sacas 8 o más, robas $50 a CADA jugador (Pentakill!). Si sacas 7 o menos, el banco te consuela con $50.',
    icon: '⚔️',
    rewardAmount: 50,
    penaltyAmount: 0,
    progressTurns: 0, // resolves on next roll
  },
  {
    id: 'quest_save_rexy',
    type: 'side_quest',
    title: 'Operación: Rescatar a Rexy',
    description:
      'Rexy se quedó AFK en zona de peligro. Pagas $50 ahora en suministros. Si das la vuelta al tablero y pasas por SALIDA sin ir al LAG, recibes $300.',
    icon: '🦕',
    rewardAmount: 300,
    penaltyAmount: 0,
    progressTurns: 1,
    immediateCost: 50,
  },
  {
    id: 'quest_skull_king',
    type: 'side_quest',
    title: 'La Apuesta del Rey Calavera',
    description:
      'Predice tu suerte. En tu próximo turno, declara si sacarás par o impar. Si aciertas, avanzas a SALIDA y cobras $200. Si fallas, pagas $100.',
    icon: '💀',
    rewardAmount: 200,
    penaltyAmount: 100,
    progressTurns: 0, // resolves on next roll
  },
  {
    id: 'quest_speedrun_luis',
    type: 'side_quest',
    title: 'El Speedrun de Luis',
    description:
      'Speedrun activado! Avanzas inmediatamente a la Estación Steam (casilla 5). Si pasas por SALIDA en el trayecto, cobras $200.',
    icon: '⚡',
    rewardAmount: 0,
    penaltyAmount: 0,
    progressTurns: 0,
    immediateCost: 0,
  },
  {
    id: 'quest_zenith_blade',
    type: 'side_quest',
    title: 'Espada del Cénit (Leona)',
    description:
      'Lanzas tu espada de luz. Tira un solo dado y avanza esa cantidad de casillas gratis (ignoras alquiler en la casilla de destino).',
    icon: '⚔️',
    rewardAmount: 0,
    penaltyAmount: 0,
    progressTurns: 0,
    immediateCost: 0,
  },
];

export const BOSS_FIGHTS: BossFight[] = [
  {
    id: 'boss_radahn_meteor',
    type: 'boss_fight',
    title: 'General Radahn: El Azote de las Estrellas',
    description:
      'Radahn desciende desde la atmósfera como un meteorito ardiente. TODOS los jugadores pierden $200. Tú además quedas aturdido y pierdes tu próximo turno.',
    icon: '☄️',
  },
  {
    id: 'boss_sephiroth_supernova',
    type: 'boss_fight',
    title: 'Sephiroth: Supernova',
    description:
      'El Ángel de una Sola Ala ha invocado la Supernova. Pagas al banco el 20% de tu Valor Total (efectivo + valor base de propiedades).',
    icon: '🌟',
  },
  {
    id: 'boss_bowser_theft',
    type: 'boss_fight',
    title: 'Bowser: El Robo de Propiedades',
    description:
      'Bowser llega en su nave y roba una de tus propiedades no mejoradas, entregándola a un oponente al azar. Sin propiedades? Te cobra $100.',
    icon: '🐢',
  },
  {
    id: 'boss_botlane_duo',
    type: 'boss_fight',
    title: 'El Dúo Dinámico: Marlon y Kaito',
    description:
      'Te has cruzado con una pareja imbatible en la botlane. Elige: pagar $300 como tributo, o ir directo al LAG por fedear.',
    icon: '👥',
  },
  {
    id: 'boss_creeper',
    type: 'boss_fight',
    title: 'El Creeper Silencioso',
    description:
      'Ssssss... ¡BOOM! Un Creeper explota en tu propiedad más mejorada, reduciendo su nivel a 0. Sin mejoras? Pierdes 50% de tu efectivo.',
    icon: '💥',
  },
  {
    id: 'boss_glados',
    type: 'boss_fight',
    title: 'GLaDOS: El Pastel es una Mentira',
    description:
      'GLaDOS te hace retroceder 3 casillas. Si caes en propiedad ajena, pagas el DOBLE de alquiler.',
    icon: '🤖',
  },
];

export function randomSideQuest(): SideQuest {
  return SIDE_QUESTS[Math.floor(Math.random() * SIDE_QUESTS.length)];
}

export function randomBossFight(): BossFight {
  return BOSS_FIGHTS[Math.floor(Math.random() * BOSS_FIGHTS.length)];
}

export function getEventById(id: string): GameEvent | undefined {
  return [...SIDE_QUESTS, ...BOSS_FIGHTS].find((e) => e.id === id);
}

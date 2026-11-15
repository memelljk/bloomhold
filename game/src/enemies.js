// The blight bugs that march on the Heartbloom. Six kinds plus two
// bosses. Armour is flat damage reduction (every hit loses at least 1);
// wasps fly, so only towers with canHitAir can target them; the splitter
// pops into two mites when killed; bosses periodically shed aphids and
// shrug off slows (slow resistance).

export const ENEMIES = {
  aphid: {
    name: 'Aphid',
    hp: 26, speed: 46, bounty: 4, damage: 1, armor: 0,
    radius: 13, color: '#7ec850', belly: '#c9ec9f',
    flying: false,
  },
  mite: {
    name: 'Mite',
    hp: 13, speed: 84, bounty: 3, damage: 1, armor: 0,
    radius: 9, color: '#e8b23a', belly: '#ffe9a8',
    flying: false,
  },
  beetle: {
    name: 'Shell Beetle',
    hp: 64, speed: 38, bounty: 7, damage: 1, armor: 3,
    radius: 15, color: '#5b6ee8', belly: '#aab6ff',
    flying: false,
  },
  snail: {
    name: 'Gloom Snail',
    hp: 240, speed: 21, bounty: 12, damage: 2, armor: 2,
    radius: 19, color: '#9a6ee8', belly: '#d9c2ff',
    flying: false,
  },
  wasp: {
    name: 'Wasp',
    hp: 34, speed: 96, bounty: 8, damage: 1, armor: 0,
    radius: 12, color: '#f2d13c', belly: '#3a3325',
    flying: true,
  },
  splitter: {
    name: 'Splitter',
    hp: 44, speed: 52, bounty: 6, damage: 1, armor: 0,
    radius: 14, color: '#e86a9a', belly: '#ffc2d9',
    flying: false,
    splitsInto: 'mite', splitCount: 2,
  },
  brute: {
    name: 'Blight Brute',
    hp: 2600, speed: 24, bounty: 150, damage: 5, armor: 4,
    radius: 30, color: '#8a4b2a', belly: '#d99a5b',
    flying: false, boss: true, slowResist: 0.5, sheds: 'aphid',
  },
  titan: {
    name: 'Rot Pumpkin',
    hp: 6800, speed: 19, bounty: 400, damage: 10, armor: 6,
    radius: 38, color: '#c25e1e', belly: '#ffb35c',
    flying: false, boss: true, slowResist: 0.65, sheds: 'mite',
  },
};

let nextId = 1;

export function makeEnemy(type, hpMul, x, y, rng) {
  const def = ENEMIES[type];
  return {
    id: nextId++,
    type,
    def,
    x, y,
    hp: Math.round(def.hp * hpMul),
    maxHp: Math.round(def.hp * hpMul),
    wp: 1, // index of the waypoint being walked toward
    dist: 0, // total distance walked (targeting: "first" = greatest dist)
    slowUntil: 0,
    slowFactor: 1,
    poisonUntil: 0,
    poisonDps: 0,
    poisonSource: null,
    shedTimer: 4,
    flashUntil: 0, // renderer-only: brief white flash when hit
    wobble: (rng ? rng() : Math.random()) * Math.PI * 2,
    dead: false,
    reached: false,
  };
}

/** Hit points multiplier for a wave: steady growth, steeper late. */
export function waveHpMul(wave) {
  const late = Math.max(0, wave - 8);
  return 1 + (wave - 1) * 0.26 + late * late * 0.045;
}

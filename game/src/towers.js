// The six flower towers — one job each, three upgrade levels, each
// with its own projectile kind (projectiles.js): archer (fast petals,
// hits air), frost (slowing splash), mortar (lobbed splash thorns),
// hive (homing poison bees), orchid (chain lightning, hits air),
// sunbloom (grows pollen). Upgrade = 80% of base cost per level
// bought; selling refunds 70% of everything invested.

export const TOWER_ORDER = ['archer', 'frost', 'mortar', 'hive', 'orchid', 'sunbloom'];

export const TOWERS = {
  archer: {
    name: 'Petal Archer',
    short: 'Archer',
    cost: 40,
    range: 150,
    rate: 2.2, // shots per second
    damage: 9,
    kind: 'petal',
    canHitAir: true,
    petalColor: '#ff8fb3',
    coreColor: '#e75480',
    desc: 'Fast petals. Hits flying wasps.',
  },
  frost: {
    name: 'Frostbloom',
    short: 'Frost',
    cost: 60,
    range: 132,
    rate: 1.1,
    damage: 6,
    kind: 'frost',
    canHitAir: true,
    slowFactor: 0.55, // move at 55% speed
    slowSeconds: 1.6,
    splash: 52,
    petalColor: '#c9f2ff',
    coreColor: '#4db8e8',
    desc: 'Chills a whole patch: bugs crawl.',
  },
  mortar: {
    name: 'Thorn Mortar',
    short: 'Mortar',
    cost: 80,
    range: 185,
    rate: 0.55,
    damage: 34,
    kind: 'thorn',
    canHitAir: false,
    splash: 62,
    petalColor: '#a8e063',
    coreColor: '#5b8c3e',
    desc: 'Lobbed thorns, heavy splash.',
  },
  hive: {
    name: 'Beehive',
    short: 'Hive',
    cost: 100,
    range: 160,
    rate: 0.9,
    damage: 5, // per sting tick comes from poisonDps
    kind: 'bee',
    canHitAir: true,
    poisonDps: 16,
    poisonSeconds: 2.5,
    petalColor: '#ffcf4d',
    coreColor: '#e8a812',
    desc: 'Bees chase and sting over time.',
  },
  orchid: {
    name: 'Storm Orchid',
    short: 'Orchid',
    cost: 130,
    range: 168,
    rate: 0.85,
    damage: 26,
    kind: 'bolt',
    canHitAir: true,
    chain: 3, // extra targets beyond the first
    chainRange: 96,
    petalColor: '#e6c8ff',
    coreColor: '#8b5cf6',
    desc: 'Lightning that leaps between bugs.',
  },
  sunbloom: {
    name: 'Sunbloom',
    short: 'Sun',
    cost: 70,
    range: 118,
    rate: 1.0,
    damage: 4,
    kind: 'petal',
    canHitAir: false,
    pollenPerCycle: 3, // every incomeSeconds, plus per level
    incomeSeconds: 5,
    petalColor: '#ffe27a',
    coreColor: '#f5a623',
    desc: 'Grows +3 pollen every 5 s.',
  },
};

/** Stat multipliers per level (index = level - 1). */
export const LEVEL_MUL = [
  { damage: 1, range: 1, rate: 1 },
  { damage: 1.7, range: 1.08, rate: 1.15 },
  { damage: 2.6, range: 1.16, rate: 1.3 },
];

export const MAX_LEVEL = 3;

/** Stats for a tower at a level, with the run's blessing modifiers
 * (state.mods from blessings.js) folded in when given. */
export function towerStats(type, level, mods) {
  const base = TOWERS[type];
  const mul = LEVEL_MUL[level - 1];
  const stats = {
    ...base,
    damage: base.damage * mul.damage,
    range: base.range * mul.range,
    rate: base.rate * mul.rate,
    chain: base.chain ? base.chain + (level - 1) : 0,
    pollenPerCycle: base.pollenPerCycle ? base.pollenPerCycle + (level - 1) * 2 : 0,
  };
  if (mods) {
    stats.damage *= mods.damage;
    stats.range *= mods.range;
    stats.rate *= mods.rate;
    if (stats.pollenPerCycle) stats.pollenPerCycle += mods.sunBonus;
    if (stats.slowFactor) {
      stats.slowFactor = Math.max(0.3, stats.slowFactor - 0.06 * mods.frost);
    }
  }
  return stats;
}

export function upgradeCost(tower) {
  if (tower.level >= MAX_LEVEL) return null;
  return Math.round(TOWERS[tower.type].cost * 0.8 * tower.level);
}

export function invested(tower) {
  let sum = TOWERS[tower.type].cost;
  for (let l = 1; l < tower.level; l++) sum += Math.round(TOWERS[tower.type].cost * 0.8 * l);
  return sum;
}

export function sellValue(tower) {
  return Math.floor(invested(tower) * 0.7);
}

export function makeTower(type, c, r, x, y) {
  return {
    type, c, r, x, y,
    level: 1,
    cooldown: 0,
    incomeTimer: 0,
    angle: -Math.PI / 2,
    recoil: 0,
    kills: 0,
    spent: TOWERS[type].cost,
  };
}

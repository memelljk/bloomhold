// The field guide — the bestiary panel. Every row is derived from
// the live game data (ENEMIES, TOWERS): HP, armour, speed class,
// bounties, costs, ranges — so the guide can never drift from the
// game it describes.

import { ENEMIES } from './enemies.js';
import { TOWERS, TOWER_ORDER } from './towers.js';

function speedClass(def) {
  if (def.speed >= 80) return 'very fast';
  if (def.speed >= 45) return 'swift';
  if (def.speed >= 30) return 'steady';
  return 'slow';
}

/** One guide row per bug kind, in data order: name, icon colour for
 * the swatch, and the trait line assembled from the definition. */
export function bugGuide() {
  // The compost barrel is a path obstacle, not a bug — it stays out
  // of the bestiary (its story is told in endless.js / world.js).
  return Object.values(ENEMIES).filter((def) => !def.barrel).map((def) => {
    const traits = ['HP ' + def.hp, speedClass(def)];
    if (def.armor > 0) traits.push('armor ' + def.armor);
    if (def.flying) traits.push('flies — air towers only');
    if (def.splitsInto) traits.push('splits into ' + def.splitCount + ' mites');
    if (def.sheds) traits.push('sheds ' + def.sheds + 's as it walks');
    if (def.boss) traits.push('BOSS — shrugs off slows');
    if (def.damage > 1) traits.push('hits the bloom for ' + def.damage);
    return {
      name: def.name,
      color: def.color,
      boss: !!def.boss,
      traits: traits.join(' · '),
      bounty: def.bounty,
    };
  });
}

/** One guide row per tower, in shop order: the definition's own role
 * line plus its cost, range and damage from the data. */
export function towerGuide() {
  return TOWER_ORDER.map((key) => {
    const def = TOWERS[key];
    return {
      type: key,
      name: def.name,
      cost: def.cost,
      line: def.desc,
      stats: 'DMG ' + def.damage + ' · RNG ' + def.range +
        (def.canHitAir ? ' · hits air' : ' · ground only'),
    };
  });
}

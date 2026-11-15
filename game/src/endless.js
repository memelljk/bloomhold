// Everbloom — the endless mode beyond the campaign. When the garden
// holds all 24 waves, the victory screen offers to keep going: the
// blight returns in procedurally grown waves, tougher every time, and
// the run becomes a score chase that ends only when the Heartbloom
// falls. There is no wave table for Everbloom — compositions and
// scaling are formulas of the wave number, so the mode is endless by
// construction and every replay of a wave is identical.
//
// Scaling (wave n > 24, endless index k = n − 24):
//   hit points  endlessHpMul(n) = waveHpMul(24) × 1.16^k — the finale's
//               toughness, compounding 16% per wave.
//   counts      each group's count grows ~+9% per wave (rounded, capped
//               so spawn schedules stay sane), and every 5th endless
//               wave adds a boss whose escorts swell with k.
//   score       clearing wave n pays a 250·k Everbloom bonus (world.js),
//               so deeper runs are worth strictly more.

import { waveHpMul } from './enemies.js';

export const ENDLESS_NAME = 'Everbloom';

function g(type, count, gap) {
  return { type, count, gap };
}

/** The rotating recipe book: endless wave k draws three consecutive
 * recipes (wrapping), so consecutive waves feel related but never
 * repeat outright. Counts in the recipes are the k = 1 baseline. */
const RECIPES = [
  [g('aphid', 14, 0.4), g('mite', 10, 0.3)],
  [g('beetle', 8, 0.8), g('wasp', 8, 0.6)],
  [g('snail', 3, 2.4), g('splitter', 8, 0.8)],
  [g('mite', 22, 0.25), g('aphid', 10, 0.4)],
  [g('wasp', 12, 0.55), g('beetle', 6, 0.9)],
  [g('splitter', 10, 0.7), g('snail', 3, 2.2)],
  [g('snail', 5, 1.9), g('wasp', 10, 0.6)],
  [g('beetle', 11, 0.7), g('mite', 14, 0.3)],
];

/** Group list for an endless wave (25+). Pure function of the wave
 * number — no RNG — so schedules are identical on every replay. */
export function endlessGroups(waveNumber) {
  const k = waveNumber - 24;
  const grow = (count) => Math.min(40, Math.round(count * (1 + 0.09 * (k - 1))));
  const groups = [];
  for (let i = 0; i < 3; i++) {
    const recipe = RECIPES[(k - 1 + i) % RECIPES.length];
    for (const grp of recipe) groups.push(g(grp.type, grow(grp.count), grp.gap));
  }
  if (k % 5 === 0) {
    // A boss every fifth endless wave, alternating the two bosses,
    // with a wasp honour guard that grows with k.
    const boss = (k / 5) % 2 === 1 ? 'brute' : 'titan';
    groups.push(g('wasp', Math.min(24, 8 + k), 0.6));
    groups.push(g(boss, 1, 1.0));
    groups.push(g('splitter', Math.min(30, 6 + k), 0.7));
  }
  return groups;
}

/** Flatten an endless wave into a spawn schedule, same shape and
 * pacing as the campaign's waveSchedule (waves.js). */
export function endlessSchedule(waveNumber) {
  const out = [];
  let t = 0.5;
  for (const grp of endlessGroups(waveNumber)) {
    for (let i = 0; i < grp.count; i++) {
      out.push({ type: grp.type, at: t });
      t += grp.gap;
    }
    t += 2.2; // breather between groups
  }
  return out;
}

/** Hit-point multiplier for endless waves: the campaign finale's
 * multiplier, compounding 16% per endless wave. */
export function endlessHpMul(waveNumber) {
  return waveHpMul(24) * Math.pow(1.16, waveNumber - 24);
}

/** One-line preview of an endless wave for the sidebar. */
export function endlessPreview(waveNumber) {
  const names = {
    aphid: 'Aphid', mite: 'Mite', beetle: 'Beetle', snail: 'Snail',
    wasp: 'Wasp', splitter: 'Splitter', brute: 'BRUTE', titan: 'ROT PUMPKIN',
  };
  return endlessGroups(waveNumber)
    .map((grp) => grp.count + '× ' + names[grp.type]).join(' · ');
}

/** Score bonus for clearing endless wave n (paid in world.js). */
export function endlessClearBonus(waveNumber) {
  return 250 * (waveNumber - 24);
}

// Screenshot scenes behind ?shot=title|battle|boss|win. Each scene builds
// a real world, plants real towers, runs the real simulation forward a
// fixed number of steps from a fixed seed, and poses the frame — so the
// screenshots are honest renders of the game mid-play, reproducible to
// the pixel from the seed.

import {
  createWorld, placeTower, startWave, stepWorld, enterEndless, trySpin,
} from './world.js';
import { makeEnemy } from './enemies.js';
import { checkQuests } from './quests.js';
import { endlessHpMul } from './endless.js';
import { sparkle } from './particles.js';
import { STEP } from './config.js';

function steps(state, seconds) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) stepWorld(state);
}

/** Put an enemy at an exact distance along the path (for posed scenes). */
function placeOnPath(state, enemy, distPx) {
  let remaining = distPx;
  const pts = state.waypoints;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg) {
      const k = seg === 0 ? 0 : remaining / seg;
      enemy.x = a.x + (b.x - a.x) * k;
      enemy.y = a.y + (b.y - a.y) * k;
      enemy.wp = i + 1;
      enemy.dist = distPx;
      return enemy;
    }
    remaining -= seg;
  }
  const last = pts[pts.length - 1];
  enemy.x = last.x;
  enemy.y = last.y;
  enemy.wp = pts.length - 1;
  enemy.dist = distPx;
  return enemy;
}

function plant(state, plan) {
  state.pollen = 100000;
  for (const [type, c, r, level] of plan) {
    const tower = placeTower(state, type, c, r);
    if (tower) {
      while (tower.level < level) {
        tower.level += 1;
        tower.spent += 50;
      }
    }
  }
}

/** A lived-in garden used by the title and victory backdrops. */
const GARDEN_PLAN = [
  ['archer', 4, 0, 2], ['frost', 8, 2, 2], ['mortar', 11, 0, 3],
  ['sunbloom', 14, 2, 2], ['hive', 5, 4, 2], ['orchid', 9, 5, 3],
  ['archer', 2, 5, 1], ['mortar', 6, 7, 2], ['frost', 10, 7, 3],
  ['hive', 13, 7, 2], ['sunbloom', 1, 8, 1], ['archer', 8, 8, 2],
  ['orchid', 5, 2, 2], ['frost', 1, 0, 2], ['hive', 15, 4, 2],
  ['archer', 7, 9, 2], ['sunbloom', 12, 9, 1], ['frost', 6, 0, 2],
  ['orchid', 10, 4, 2], ['hive', 7, 4, 2],
];

export function sceneTitle(seed) {
  const state = createWorld(seed);
  plant(state, GARDEN_PLAN);
  // A parade of bugs posed along the path behind the title panel.
  const parade = [
    ['aphid', 260], ['mite', 420], ['aphid', 560], ['beetle', 760],
    ['wasp', 980], ['snail', 1250], ['splitter', 1500], ['wasp', 1750],
    ['beetle', 2050], ['aphid', 2300],
  ];
  for (const [type, dist] of parade) {
    // Parade bugs are posed at ×5 HP so the cover fight lasts.
    state.enemies.push(placeOnPath(state, makeEnemy(type, 5, 0, 0, state.rng), dist));
  }
  steps(state, 1.4); // the garden fights behind its own title: petals up
  state.particles = state.particles.filter((p) => p.kind === 'mote');
  // planting bursts are noise on a posed cover
  // …but a dusting of pollen sparkles over the garden is pure cover art.
  for (let i = 0; i < 48; i++) {
    sparkle(state, 40 + state.rng() * 950, 90 + state.rng() * 580,
      i % 3 ? '#ffd94d' : '#ffd1e8');
  }
  state.time = 3.7; // pose the ambient animation mid-beat
  state.pollen = 170;
  state.log = 'Plant flowers on the grass. Stop the blight bugs!';
  return state;
}

/** Extra bugs posed along the path so the whole garden is under attack. */
function inject(state, list) {
  for (const [type, dist] of list) {
    const e = makeEnemy(type, 1, 0, 0, state.rng);
    // Scale to the current wave's toughness, then soften: the frame
    // should show a fight in progress, not a massacre already over.
    e.hp = e.maxHp = Math.round(e.def.hp * (1 + (state.wave - 1) * 0.26));
    state.enemies.push(placeOnPath(state, e, dist));
  }
}

function busiestTower(state) {
  let best = state.towers[0];
  for (const t of state.towers) if (t.kills > (best ? best.kills : -1)) best = t;
  return best;
}

export function sceneBattle(seed) {
  const state = createWorld(seed);
  state.phase = 'play';
  plant(state, [
    ['archer', 4, 0, 2], ['archer', 7, 0, 1], ['frost', 10, 2, 2],
    ['mortar', 12, 0, 2], ['sunbloom', 14, 1, 2], ['hive', 5, 4, 2],
    ['orchid', 8, 5, 2], ['archer', 2, 5, 3], ['frost', 11, 4, 1],
    ['mortar', 6, 7, 3], ['hive', 13, 7, 2], ['sunbloom', 1, 8, 1],
    ['archer', 9, 8, 2], ['orchid', 4, 7, 1], ['frost', 12, 4, 2],
    ['orchid', 14, 4, 2], ['mortar', 11, 9, 2], ['archer', 12, 5, 1],
  ]);
  state.wave = 9;
  state.kills = 268;
  state.score = 6840;
  state.lives = 18;
  state.blessings = ['sunpetals', 'golden'];
  startWave(state); // wave 10: gloom snails, wasps, aphids
  steps(state, 5);
  // A second front deep in the garden: every tower row has a target.
  inject(state, [
    ['beetle', 1080], ['aphid', 1180], ['wasp', 1330], ['splitter', 1470],
    ['snail', 1620], ['aphid', 1560], ['mite', 1690], ['aphid', 1760],
    ['wasp', 1900], ['beetle', 2030], ['splitter', 2180], ['mite', 2300],
    ['snail', 2450], ['wasp', 2560], ['aphid', 960],
    ['mite', 1240], ['beetle', 2130], ['aphid', 2620], ['splitter', 1390],
  ]);
  steps(state, 1.7);
  state.pollen = 236;
  state.selected = busiestTower(state);
  // The scene is a mid-campaign pose: credit the veteran on display with
  // a kill count that matches the campaign totals above.
  if (state.selected) state.selected.kills = Math.max(state.selected.kills, 23);
  state.banner = null;
  state.log = 'Wave 10 — gloom snails shrug off petals. Frost and thorns bite!';
  return state;
}

export function sceneBoss(seed) {
  const state = createWorld(seed);
  state.phase = 'play';
  plant(state, [
    ['archer', 4, 0, 3], ['orchid', 7, 0, 3], ['frost', 10, 2, 3],
    ['mortar', 12, 0, 3], ['sunbloom', 14, 1, 3], ['hive', 5, 4, 3],
    ['orchid', 8, 5, 3], ['archer', 2, 5, 3], ['frost', 11, 4, 3],
    ['mortar', 6, 7, 3], ['hive', 13, 7, 3], ['sunbloom', 1, 8, 2],
    ['archer', 9, 8, 3], ['mortar', 4, 7, 2], ['frost', 14, 5, 2],
    ['orchid', 15, 4, 2], ['archer', 7, 9, 3],
  ]);
  state.wave = 23;
  state.kills = 587;
  state.score = 15980;
  state.lives = 14;
  state.blessings = ['sunpetals', 'longroots', 'winter', 'golden'];
  startWave(state); // wave 24: the Rot Pumpkin
  steps(state, 14); // the aphid vanguard is met and thinned by the towers
  // Walk the boss deep into the garden for the portrait, with an
  // entourage strung along the middle segments.
  const boss = state.enemies.find((e) => e.def.boss);
  if (boss) {
    placeOnPath(state, boss, 1740);
    boss.hp = Math.round(boss.maxHp * 0.38); // posed mid-collapse, not mid-arrival
  }
  inject(state, [
    ['wasp', 1150], ['beetle', 1290], ['splitter', 1440], ['wasp', 1560],
    ['snail', 1930], ['beetle', 2070], ['wasp', 2210], ['splitter', 2330],
  ]);
  steps(state, 3.4); // longer settle: more tower fire in the air
  if (boss && !boss.dead) {
    for (let i = 0; i < 9; i++) {
      sparkle(state, boss.x + (state.rng() - 0.5) * 70, boss.y + (state.rng() - 0.5) * 56,
        i % 2 ? '#ffd94d' : '#ff9d5c');
    }
  }
  state.pollen = 412;
  state.selected = busiestTower(state);
  if (state.selected) state.selected.kills = Math.max(state.selected.kills, 57);
  state.banner = null;
  state.log = 'FINAL WAVE — the Rot Pumpkin is in the garden. Everything, fire!';
  return state;
}

export function sceneWin(seed) {
  const state = createWorld(seed);
  plant(state, GARDEN_PLAN);
  state.particles = [];
  state.phase = 'won';
  state.wave = 24;
  state.blessings = ['sunpetals', 'golden', 'longroots', 'spring', 'winter'];
  state.kills = 642;
  state.leaks = 3;
  state.earned = 5480;
  state.lives = 11;
  state.pollen = 386;
  state.score = 642 * 10 + 24 * 25 + 11 * 250 + 386 * 2 + 2400;
  state.overStats = {
    waves: 24, kills: 642, leaks: 3, earned: 5480,
    lives: 11, score: state.score, towers: state.towers.length,
  };
  state.log = 'The garden holds. The Heartbloom blooms on.';
  state.time = 5.2;
  return state;
}

/** The field guide open over an autumn fight (wave 15). */
export function sceneGuide(seed) {
  const state = createWorld(seed);
  state.phase = 'play';
  plant(state, [
    ['archer', 4, 0, 2], ['archer', 7, 0, 2], ['frost', 10, 2, 3],
    ['mortar', 12, 0, 2], ['sunbloom', 14, 1, 2], ['hive', 5, 4, 3],
    ['orchid', 8, 5, 3], ['archer', 2, 5, 2], ['frost', 11, 4, 2],
    ['mortar', 6, 7, 3], ['hive', 13, 7, 2], ['sunbloom', 1, 8, 2],
    ['archer', 9, 8, 3], ['orchid', 4, 7, 2], ['frost', 12, 4, 2],
    ['orchid', 14, 4, 3], ['mortar', 11, 9, 2],
  ]);
  state.wave = 14;
  state.kills = 402;
  state.score = 11230;
  state.lives = 17;
  state.blessings = ['sunpetals', 'golden', 'winter'];
  startWave(state); // wave 15: splitters and gloom snails, in autumn
  steps(state, 6);
  inject(state, [
    ['splitter', 1180], ['snail', 1420], ['mite', 1560], ['aphid', 1750],
    ['splitter', 1980], ['snail', 2240], ['wasp', 2050],
  ]);
  steps(state, 1.2);
  state.pollen = 288;
  state.showGuide = true;
  state.banner = null;
  state.log = 'The field guide — every bug & bloom, from the garden\u2019s own records.';
  return state;
}

/** The Lucky Sprout panel in the lull after wave 17 (autumn), one
 * honest spin on the scene's own luck stream just landed. */
export function sceneSlot(seed) {
  const state = createWorld(seed);
  state.phase = 'play';
  plant(state, GARDEN_PLAN);
  state.wave = 17;
  state.kills = 486;
  state.score = 13920;
  state.lives = 16;
  state.blessings = ['sunpetals', 'golden', 'winter', 'spring'];
  state.pollen = 300;
  state.showSpin = true;
  trySpin(state); // legal here: between waves, no offer, pollen paid
  steps(state, 2.4); // the reels land and the paytable settles
  state.banner = null;
  state.log = 'Between waves, the Lucky Sprout offers a spin…';
  return state;
}

/** Everbloom: the endless titan of wave 34, fought in high summer of
 * the second year, by a garden that already won once. */
export function sceneEndless(seed) {
  const state = createWorld(seed);
  plant(state, GARDEN_PLAN);
  // A second planting fills the calm mid-field: a veteran garden at
  // wave 34 stands dense, not decorative.
  plant(state, [
    ['archer', 6, 0, 3], ['frost', 3, 2, 3], ['orchid', 10, 4, 3],
    ['hive', 7, 4, 3], ['sunbloom', 14, 9, 2], ['mortar', 2, 9, 3],
  ]);
  for (const t of state.towers) { t.level = 3; t.spent += 100; }
  state.phase = 'won'; // the garden won its campaign…
  state.wave = 24;
  state.kills = 655;
  state.score = 76900;
  state.lives = 12;
  state.blessings = ['sunpetals', 'golden', 'longroots', 'spring', 'winter', 'swiftsap'];
  enterEndless(state); // …and chose to keep going
  state.wave = 33;
  startWave(state); // wave 34: an Everbloom titan (every 5th wave)
  steps(state, 13);
  // The scheduled titan marches in late (~80 s in); pose it mid-path
  // at the wave's true scaling, the same way sceneBoss poses its own.
  const boss = makeEnemy('titan', endlessHpMul(34) * 1.25, 0, 0, state.rng);
  state.enemies.push(boss);
  placeOnPath(state, boss, 1560);
  boss.hp = Math.round(boss.maxHp * 0.58);
  inject(state, [
    ['aphid', 520], ['mite', 640], ['beetle', 770],
    ['wasp', 1080], ['beetle', 1230], ['splitter', 1390], ['wasp', 1830],
    ['snail', 1990], ['beetle', 2150], ['splitter', 2310], ['mite', 2440],
  ]);
  steps(state, 3.2);
  // The wave's own barrels were shot open during the settle (that is
  // their job); pose two fresh ones with lit fuses — one just ahead
  // of the titan where its escort bunches, one deep on the last bend.
  for (const dist of [1470, 2280]) {
    state.enemies.push(placeOnPath(state, makeEnemy('barrel', 1, 0, 0, state.rng), dist));
  }
  for (let i = 0; i < 9; i++) {
    sparkle(state, boss.x + (state.rng() - 0.5) * 80, boss.y + (state.rng() - 0.5) * 60,
      i % 2 ? '#ffd94d' : '#ff9d5c');
  }
  state.pollen = 356;
  state.selected = busiestTower(state);
  if (state.selected) state.selected.kills = Math.max(state.selected.kills, 74);
  state.banner = null;
  state.log = 'Everbloom wave 34 — the titan returns, tougher than ever. Hold!';
  return state;
}

/** The Bloom Quests board open over the same autumn fight the guide
 * scene poses: five of the six trials honestly complete (the run's
 * own counters say so), Year Keeper still open at wave 15. */
export function sceneQuests(seed) {
  const state = sceneGuide(seed);
  state.showGuide = false;
  state.showQuests = true;
  state.earned = 3900; // harvest long since banked (guide scene omits it)
  state.flawless = 3; // three leak-free clears in the bank
  state.bossKills = 1; // the wave-12 Brute fell to this garden
  checkQuests(state); // marks the five earned trials, banks their score
  state.banner = null; // the last completion banner has faded by now
  state.log = 'The Bloom Quests — five trials done, the Year Keeper still open.';
  return state;
}

export function buildScene(name, seed) {
  if (name === 'battle') return sceneBattle(seed);
  if (name === 'boss') return sceneBoss(seed);
  if (name === 'win') return sceneWin(seed);
  if (name === 'guide') return sceneGuide(seed);
  if (name === 'slot') return sceneSlot(seed);
  if (name === 'endless') return sceneEndless(seed);
  if (name === 'quests') return sceneQuests(seed);
  return sceneTitle(seed);
}

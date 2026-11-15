// Screenshot scenes behind ?shot=title|battle|boss|win. Each scene builds
// a real world, plants real towers, runs the real simulation forward a
// fixed number of steps from a fixed seed, and poses the frame — so the
// screenshots are honest renders of the game mid-play, reproducible to
// the pixel from the seed.

import { createWorld, placeTower, startWave, stepWorld } from './world.js';
import { makeEnemy } from './enemies.js';
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
  ['archer', 7, 9, 2], ['sunbloom', 12, 9, 1],
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
    state.enemies.push(placeOnPath(state, makeEnemy(type, 1, 0, 0, state.rng), dist));
  }
  state.particles = []; // planting bursts are noise on a posed cover
  // …but a dusting of pollen sparkles over the garden is pure cover art.
  for (let i = 0; i < 34; i++) {
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
    boss.hp = Math.round(boss.maxHp * 0.62);
  }
  inject(state, [
    ['wasp', 1150], ['beetle', 1290], ['splitter', 1440], ['wasp', 1560],
    ['snail', 1930], ['beetle', 2070], ['wasp', 2210], ['splitter', 2330],
  ]);
  steps(state, 2.4);
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

export function buildScene(name, seed) {
  if (name === 'battle') return sceneBattle(seed);
  if (name === 'boss') return sceneBoss(seed);
  if (name === 'win') return sceneWin(seed);
  return sceneTitle(seed);
}

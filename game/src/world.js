// The world: game state, spawning, tower fire control, damage, economy,
// win/lose. One fixed-step update (STEP seconds) that the renderer only
// reads. All randomness comes from state.rng, so a seed replays exactly.

import {
  PATH_CELLS, HEART_CELL, cellCenter, pathCellKeys, STEP,
} from './config.js';
import { makeRng, randRange } from './random.js';
import { ENEMIES, makeEnemy, waveHpMul } from './enemies.js';
import { TOWERS, towerStats, makeTower } from './towers.js';
import { WAVES, TOTAL_WAVES, waveSchedule } from './waves.js';
import { fireProjectile, stepProjectiles } from './projectiles.js';
import { burst, sparkle, floater, stepParticles } from './particles.js';
import { sfx } from './audio.js';

export const START_POLLEN = 170;
export const START_LIVES = 20;

export function createWorld(seed) {
  const rng = makeRng(seed);
  const waypoints = PATH_CELLS.map(([c, r]) => cellCenter(c, r));
  const state = {
    rng,
    seed,
    time: 0,
    phase: 'title', // title | play | won | lost
    wave: 0,
    waveActive: false,
    waveTime: 0,
    schedule: [],
    spawned: 0,
    pollen: START_POLLEN,
    lives: START_LIVES,
    score: 0,
    kills: 0,
    leaks: 0,
    earned: 0, // total pollen earned (victory screen)
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    floaters: [],
    effects: [], // lightning bolts { points, life, maxLife, color }
    waypoints,
    pathKeys: pathCellKeys(),
    decor: makeDecor(rng),
    shopSel: null, // tower type chosen in the shop
    selected: null, // placed tower clicked
    hoverCell: null,
    mouse: { x: 0, y: 0 },
    banner: null, // { text, sub, until }
    log: 'Plant flowers on the grass. Stop the blight bugs!',
    speed: 1,
    paused: false,
    muted: false,
    soundOn: false, // flips true after the first real user gesture
    ui: {}, // button rects, filled by the renderer each frame
    overStats: null,
  };
  return state;
}

/** Deterministic garden decoration: flower tufts, stones, grass blades. */
function makeDecor(rng) {
  const keys = pathCellKeys();
  const decor = [];
  for (let i = 0; i < 210; i++) {
    const c = Math.floor(rng() * 16);
    const r = Math.floor(rng() * 10);
    if (keys.has(c + ',' + r)) continue;
    if (c === HEART_CELL.c && r === HEART_CELL.r) continue;
    const x = 8 + c * 64 + randRange(rng, 8, 56);
    const y = 62 + r * 64 + randRange(rng, 8, 56);
    const kind = rng();
    decor.push({
      x, y,
      kind: kind < 0.45 ? 'tuft' : kind < 0.75 ? 'flower' : 'stone',
      color: ['#ff8fb3', '#ffd94d', '#c9a0ff', '#ffffff', '#ff9d5c'][Math.floor(rng() * 5)],
      s: randRange(rng, 0.7, 1.3),
    });
  }
  return decor;
}

export function banner(state, text, sub, seconds = 2.2) {
  state.banner = { text, sub, until: state.time + seconds };
}

export function log(state, msg) {
  state.log = msg;
}

/* ------------------------------------------------------------------ */
/* Building                                                            */
/* ------------------------------------------------------------------ */

export function cellBuildable(state, c, r) {
  if (state.pathKeys.has(c + ',' + r)) return false;
  if (c === HEART_CELL.c && r === HEART_CELL.r) return false;
  return !state.towers.some((t) => t.c === c && t.r === r);
}

export function placeTower(state, type, c, r) {
  const def = TOWERS[type];
  if (state.pollen < def.cost) return false;
  if (!cellBuildable(state, c, r)) return false;
  const { x, y } = cellCenter(c, r);
  const tower = makeTower(type, c, r, x, y);
  state.towers.push(tower);
  state.pollen -= def.cost;
  burst(state, x, y, '#c9ec9f', 10, 70, 0.5, 3);
  if (state.soundOn) sfx.plant();
  log(state, def.name + ' planted. ' + def.desc);
  return tower;
}

export function doUpgrade(state, tower, cost) {
  if (cost == null || state.pollen < cost || tower.level >= 3) return false;
  state.pollen -= cost;
  tower.level += 1;
  tower.spent += cost;
  burst(state, tower.x, tower.y, '#ffd94d', 14, 90, 0.6, 3.5);
  if (state.soundOn) sfx.upgrade();
  log(state, TOWERS[tower.type].name + ' grew to level ' + tower.level + '!');
  return true;
}

export function sellTower(state, tower, value) {
  state.pollen += value;
  state.towers = state.towers.filter((t) => t !== tower);
  if (state.selected === tower) state.selected = null;
  burst(state, tower.x, tower.y, '#ffd94d', 8, 70, 0.4, 3);
  log(state, TOWERS[tower.type].name + ' sold for ' + value + ' pollen.');
}

/* ------------------------------------------------------------------ */
/* Waves                                                               */
/* ------------------------------------------------------------------ */

export function startWave(state) {
  if (state.waveActive || state.phase !== 'play') return false;
  if (state.wave >= TOTAL_WAVES) return false;
  state.wave += 1;
  state.schedule = waveSchedule(state.wave);
  state.spawned = 0;
  state.waveTime = 0;
  state.waveActive = true;
  const names = {
    brute: 'The Blight Brute lumbers in!',
    titan: 'THE ROT PUMPKIN — final stand!',
  };
  const special = state.schedule.find((s) => names[s.type]);
  banner(state, 'Wave ' + state.wave + ' / ' + TOTAL_WAVES,
    special ? names[special.type] : '', 2.0);
  if (state.soundOn) sfx.horn();
  return true;
}

function finishWave(state) {
  state.waveActive = false;
  const bonus = 20 + state.wave * 2;
  const interest = Math.min(50, Math.floor(state.pollen * 0.05));
  state.pollen += bonus + interest;
  state.earned += bonus + interest;
  state.score += 100 + state.wave * 25;
  if (state.wave >= TOTAL_WAVES) {
    winGame(state);
    return;
  }
  log(state, 'Wave ' + state.wave + ' cleared! Bonus +' + bonus +
    ' pollen, interest +' + interest + '.');
  banner(state, 'Wave cleared!', '+' + (bonus + interest) + ' pollen', 1.6);
  if (state.soundOn) sfx.coin();
}

function winGame(state) {
  state.phase = 'won';
  state.score += state.lives * 250 + state.pollen * 2;
  state.overStats = snapshotStats(state);
  if (state.soundOn) sfx.win();
}

function loseGame(state) {
  state.phase = 'lost';
  state.overStats = snapshotStats(state);
  if (state.soundOn) sfx.lose();
}

function snapshotStats(state) {
  return {
    waves: state.wave,
    kills: state.kills,
    leaks: state.leaks,
    earned: state.earned,
    lives: Math.max(0, state.lives),
    score: state.score,
    towers: state.towers.length,
  };
}

/* ------------------------------------------------------------------ */
/* Combat                                                              */
/* ------------------------------------------------------------------ */

export function hitEnemy(state, enemy, rawDamage, source, extra = {}) {
  if (enemy.dead || enemy.reached) return;
  const dmg = Math.max(1, rawDamage - enemy.def.armor);
  enemy.hp -= dmg;
  if (extra.slowFactor) {
    const resist = enemy.def.slowResist || 0;
    const factor = 1 - (1 - extra.slowFactor) * (1 - resist);
    if (factor < enemy.slowFactor || state.time >= enemy.slowUntil) {
      enemy.slowFactor = factor;
    }
    enemy.slowUntil = Math.max(enemy.slowUntil,
      state.time + extra.slowSeconds * (1 - resist * 0.5));
  }
  if (extra.poisonDps) {
    enemy.poisonDps = Math.max(enemy.poisonDps, extra.poisonDps);
    enemy.poisonUntil = state.time + extra.poisonSeconds;
    enemy.poisonSource = source;
  }
  if (enemy.hp <= 0) killEnemy(state, enemy, source);
}

function killEnemy(state, enemy, source) {
  enemy.dead = true;
  state.kills += 1;
  if (source) source.kills += 1;
  state.pollen += enemy.def.bounty;
  state.earned += enemy.def.bounty;
  state.score += enemy.def.bounty * 10 + state.wave * 2;
  burst(state, enemy.x, enemy.y, enemy.def.color, enemy.def.boss ? 30 : 9,
    enemy.def.boss ? 200 : 110, 0.6, 4);
  sparkle(state, enemy.x, enemy.y - 6, '#ffd94d');
  if (enemy.def.boss) {
    banner(state, enemy.def.name + ' felled!', '+' + enemy.def.bounty + ' pollen', 2.4);
    floater(state, enemy.x, enemy.y - 30, '+' + enemy.def.bounty, '#ffd94d');
  }
  if (state.soundOn) sfx.pop();
  if (enemy.def.splitsInto) {
    for (let i = 0; i < enemy.def.splitCount; i++) {
      const child = makeEnemy(enemy.def.splitsInto, waveHpMul(state.wave),
        enemy.x + (i === 0 ? -10 : 10), enemy.y + (i === 0 ? 6 : -6), state.rng);
      child.wp = enemy.wp;
      child.dist = enemy.dist - 1 - i;
      state.enemies.push(child);
    }
  }
}

function leakEnemy(state, enemy) {
  enemy.reached = true;
  state.lives -= enemy.def.damage;
  state.leaks += 1;
  floater(state, state.waypoints[state.waypoints.length - 1].x - 10,
    enemy.y - 18, '-' + enemy.def.damage + ' ♥', '#ff5d73');
  burst(state, enemy.x, enemy.y, '#ff5d73', 12, 120, 0.5, 3.5);
  if (state.soundOn) sfx.leak();
  if (state.lives <= 0) loseGame(state);
}

/** Instant chain lightning for the Storm Orchid. */
function fireBolt(state, tower, stats, first) {
  const hit = new Set();
  const points = [[tower.x, tower.y - 20]];
  let current = first;
  let jumps = 0;
  while (current && jumps <= stats.chain) {
    hit.add(current);
    points.push([current.x, current.y]);
    hitEnemy(state, current, stats.damage, tower);
    jumps += 1;
    if (jumps > stats.chain) break;
    let next = null;
    let best = stats.chainRange;
    for (const e of state.enemies) {
      if (e.dead || e.reached || hit.has(e)) continue;
      const d = Math.hypot(e.x - current.x, e.y - current.y);
      if (d < best) { best = d; next = e; }
    }
    current = next;
  }
  // Jagged polyline through the hit points for the renderer.
  const jagged = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    jagged.push([x0, y0]);
    const segs = 3;
    for (let s = 1; s < segs; s++) {
      const k = s / segs;
      jagged.push([
        x0 + (x1 - x0) * k + (state.rng() - 0.5) * 16,
        y0 + (y1 - y0) * k + (state.rng() - 0.5) * 16,
      ]);
    }
  }
  jagged.push(points[points.length - 1]);
  state.effects.push({ points: jagged, life: 0.14, maxLife: 0.14, color: '#ffe95e' });
  if (state.soundOn) sfx.zap();
}

function towerTarget(state, tower, stats) {
  let best = null;
  let bestDist = -1;
  for (const e of state.enemies) {
    if (e.dead || e.reached) continue;
    if (e.def.flying && !stats.canHitAir) continue;
    const d = Math.hypot(e.x - tower.x, e.y - tower.y);
    if (d > stats.range + e.def.radius) continue;
    if (e.dist > bestDist) { bestDist = e.dist; best = e; }
  }
  return best;
}

function stepTowers(state, dt) {
  for (const tower of state.towers) {
    const stats = towerStats(tower.type, tower.level);
    tower.recoil = Math.max(0, tower.recoil - dt * 6);
    if (tower.type === 'sunbloom') {
      tower.incomeTimer += dt;
      if (tower.incomeTimer >= stats.incomeSeconds) {
        tower.incomeTimer = 0;
        state.pollen += stats.pollenPerCycle;
        state.earned += stats.pollenPerCycle;
        floater(state, tower.x, tower.y - 26, '+' + stats.pollenPerCycle, '#ffd94d');
        sparkle(state, tower.x, tower.y - 10, '#ffe27a');
      }
    }
    tower.cooldown -= dt;
    const target = towerTarget(state, tower, stats);
    if (target) {
      tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
      if (tower.cooldown <= 0) {
        tower.cooldown = 1 / stats.rate;
        tower.recoil = 1;
        if (stats.kind === 'bolt') {
          fireBolt(state, tower, stats, target);
        } else {
          fireProjectile(state, tower, stats, target);
          if (state.soundOn) {
            if (stats.kind === 'frost') sfx.frost();
            else if (stats.kind === 'thorn') sfx.thud();
            else sfx.shoot();
          }
        }
      }
    }
  }
}

function stepEnemies(state, dt) {
  const end = state.waypoints[state.waypoints.length - 1];
  for (const e of state.enemies) {
    if (e.dead || e.reached) continue;
    if (e.poisonUntil > state.time && e.poisonDps > 0) {
      e.hp -= e.poisonDps * dt;
      if (e.hp <= 0) { killEnemy(state, e, e.poisonSource); continue; }
    }
    const slowed = state.time < e.slowUntil;
    const speed = e.def.speed * (slowed ? e.slowFactor : 1);
    let move = speed * dt;
    while (move > 0 && !e.reached) {
      const target = state.waypoints[e.wp];
      if (!target) { leakEnemy(state, e); break; }
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d <= move) {
        e.x = target.x; e.y = target.y; e.dist += d; move -= d;
        e.wp += 1;
        if (e.wp >= state.waypoints.length) {
          e.x = end.x; e.y = end.y;
          leakEnemy(state, e);
        }
      } else {
        e.x += (dx / d) * move;
        e.y += (dy / d) * move;
        e.dist += move;
        move = 0;
      }
    }
    if (e.def.sheds && !e.dead && !e.reached) {
      e.shedTimer -= dt;
      if (e.shedTimer <= 0) {
        e.shedTimer = 5;
        const child = makeEnemy(e.def.sheds, waveHpMul(state.wave), e.x - 14, e.y + 8, state.rng);
        child.wp = e.wp;
        child.dist = e.dist - 2;
        state.enemies.push(child);
      }
    }
  }
  state.enemies = state.enemies.filter((e) => !e.dead && !e.reached);
}

/* ------------------------------------------------------------------ */
/* Main step                                                           */
/* ------------------------------------------------------------------ */

export function stepWorld(state) {
  const dt = STEP;
  state.time += dt;
  if (state.banner && state.time > state.banner.until) state.banner = null;

  if (state.phase === 'play' && state.waveActive) {
    state.waveTime += dt;
    while (state.spawned < state.schedule.length &&
           state.schedule[state.spawned].at <= state.waveTime) {
      const item = state.schedule[state.spawned];
      const start = state.waypoints[0];
      const e = makeEnemy(item.type, waveHpMul(state.wave), start.x, start.y, state.rng);
      state.enemies.push(e);
      state.spawned += 1;
    }
    if (state.spawned >= state.schedule.length && state.enemies.length === 0) {
      finishWave(state);
    }
  }

  if (state.phase === 'play' || state.phase === 'title') {
    stepEnemies(state, dt);
    stepTowers(state, dt);
    stepProjectiles(state, dt, hitEnemy);
  }
  stepParticles(state, dt);
}

export { TOTAL_WAVES, WAVES };

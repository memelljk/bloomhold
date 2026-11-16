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
import { burst, sparkle, floater, hitSpark, mote, stepParticles } from './particles.js';
import { freshMods, rollOffer } from './blessings.js';
import { endlessSchedule, endlessHpMul, endlessClearBonus } from './endless.js';
import { startSpin, settleSpin, SPINS_PER_BREAK } from './luckyspin.js';
import { seasonForWave, isSeasonTurnWave } from './seasons.js';
import { checkQuests } from './quests.js';
import { sfx } from './audio.js';

export const START_POLLEN = 170;
export const START_LIVES = 20;

export function createWorld(seed) {
  const rng = makeRng(seed);
  const waypoints = PATH_CELLS.map(([c, r]) => cellCenter(c, r));
  const state = {
    rng,
    offerRng: makeRng((seed ^ 0xb1e55) >>> 0), // blessings roll apart
    luckRng: makeRng((seed ^ 0x5eed) >>> 0), // slot machine rolls apart
    seed,
    time: 0,
    phase: 'title', // title | play | won | lost
    mode: 'campaign', // campaign | endless (Everbloom, endless.js)
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
    mods: freshMods(), // run-wide blessing modifiers (blessings.js)
    blessings: [], // blessing ids taken this run, in order
    offer: null, // blessing ids currently offered, or null
    spinsLeft: SPINS_PER_BREAK, // Lucky Sprout spins left this break
    spinsTaken: 0, // Lucky Sprout spins this run (end-screen stat)
    spin: null, // current slot spin record (luckyspin.js)
    spinBuff: null, // Bee Frenzy { rate, wavesLeft } or null
    bossKills: 0, // bosses felled this run (Bloom Quests)
    flawless: 0, // waves cleared without a single leak (Bloom Quests)
    waveLeaks: 0, // leaks in the wave currently marching
    questsDone: [], // Bloom Quest ids completed this run, in order
    ranks: {}, // wave-clear ranks by letter (arcade mission framing)
    lastRank: null, // rank of the most recent cleared wave
    bonusScore: 0, // score paid by score-only systems (quests/ranks/blocks)
    blocks: [], // this wave's Mystery Seed Blocks (world.stepWorld pops)
    blocksHit: 0, // seed blocks popped this run (end-screen stat)
    shake: 0, // seconds of screen shake left (barrel explosions)
    showGuide: false, // field guide overlay (renderer/input only)
    showSpin: false, // Lucky Sprout panel (renderer/input only)
    showQuests: false, // Bloom Quests board (renderer/input only)
    moteTimer: 0, // ambient drifting spores/fireflies spawn clock
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

/** Deterministic garden decoration: tufts, flowers, bushes, mushrooms,
 * clover patches, pebbles and stones scattered off the path. */
function makeDecor(rng) {
  const keys = pathCellKeys();
  const decor = [];
  for (let i = 0; i < 340; i++) {
    const c = Math.floor(rng() * 16);
    const r = Math.floor(rng() * 10);
    if (keys.has(c + ',' + r)) continue;
    if (c === HEART_CELL.c && r === HEART_CELL.r) continue;
    const x = 8 + c * 64 + randRange(rng, 8, 56);
    const y = 62 + r * 64 + randRange(rng, 8, 56);
    const k = rng();
    decor.push({
      x, y,
      kind: k < 0.34 ? 'tuft' : k < 0.58 ? 'flower' : k < 0.7 ? 'bush' :
        k < 0.8 ? 'clover' : k < 0.88 ? 'mushroom' : k < 0.95 ? 'pebbles' : 'stone',
      color: ['#ff8fb3', '#ffd94d', '#c9a0ff', '#ffffff', '#ff9d5c'][Math.floor(rng() * 5)],
      s: randRange(rng, 0.7, 1.3),
    });
  }
  return decor;
}

export function banner(state, text, sub, seconds = 2.2) {
  state.banner = { text, sub, until: state.time + seconds };
}

/** HP multiplier for the wave being fought: the campaign table, or
 * the Everbloom compounding formula once endless. In campaign this
 * is waveHpMul itself — campaign replays are untouched. */
export function hpMulFor(state) {
  return state.mode === 'endless' ? endlessHpMul(state.wave) : waveHpMul(state.wave);
}

/** The modifiers towers read: blessing mods, with a Bee Frenzy
 * folded in while it lasts. No frenzy → state.mods itself. */
function effectiveMods(state) {
  if (!state.spinBuff) return state.mods;
  return { ...state.mods, rate: state.mods.rate * state.spinBuff.rate };
}

/** Settle a Lucky Sprout spin whose reels have landed, applying the
 * world's side effects (log, jackpot banner, sound). The paytable
 * itself lives in luckyspin.js. */
function settleSpinNow(state) {
  const res = settleSpin(state);
  if (!res) return;
  log(state, '🎰 ' + res.text);
  if (res.kind === 'jackpot') banner(state, '🎰 LUCKY SPROUT JACKPOT!', res.text, 2.6);
  if (state.soundOn) {
    if (res.pollen > 0 || res.kind === 'frenzy' || res.kind === 'lives') sfx.coin();
    else sfx.pop();
  }
}

/** The Lucky Sprout lever, with its sound. All rules live in
 * luckyspin.js; this is the world's doorway to them. */
export function trySpin(state) {
  const ok = startSpin(state);
  if (ok && state.soundOn) sfx.pop();
  return ok;
}

export function log(state, msg) {
  state.log = msg;
}

/* --- Building --- */

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
  // A watering flourish for the new growth stage: blue droplets
  // shower the sprout as the gold sparkles rise (particles only).
  burst(state, tower.x, tower.y - 8, '#7ec8ff', 9, 60, 0.45, 2.4);
  if (state.soundOn) sfx.upgrade();
  log(state, TOWERS[tower.type].name + ' grew to level ' + tower.level + '!');
  checkQuests(state); // a tower reaching full bloom may close a trial
  return true;
}

export function sellTower(state, tower, value) {
  state.pollen += value;
  state.towers = state.towers.filter((t) => t !== tower);
  if (state.selected === tower) state.selected = null;
  burst(state, tower.x, tower.y, '#ffd94d', 8, 70, 0.4, 3);
  log(state, TOWERS[tower.type].name + ' sold for ' + value + ' pollen.');
}

/* --- Waves --- */

/** Two Mystery Seed Blocks float beside the path each wave, at
 * distances rolled from the wave number: a bug bumping one pops it
 * for score and a coin sparkle (stepWorld). Pure function of the
 * run seed + wave, so replays float the same blocks. */
function seedBlocks(state) {
  const rng = makeRng((state.seed ^ (state.wave * 7919)) >>> 0);
  const blocks = [];
  for (const dist of [620 + rng() * 300, 1750 + rng() * 400]) {
    let rem = dist;
    const pts = state.waypoints;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (rem <= seg) {
        const k = seg ? rem / seg : 0;
        const dx = (b.x - a.x) / (seg || 1);
        const dy = (b.y - a.y) / (seg || 1);
        blocks.push({
          x: a.x + (b.x - a.x) * k - dy * 46,
          y: a.y + (b.y - a.y) * k + dx * 46,
          hit: false, ph: rng() * 6,
        });
        break;
      }
      rem -= seg;
    }
  }
  return blocks;
}

export function startWave(state) {
  if (state.waveActive || state.phase !== 'play') return false;
  if (state.mode !== 'endless' && state.wave >= TOTAL_WAVES) return false;
  // A spin still rolling is called on the spot: its reels land now and
  // the paytable settles before the wave marches (no dangling spins).
  if (state.spin && !state.spin.paid) state.spin.resolveAt = state.time;
  settleSpinNow(state);
  state.showSpin = false;
  state.offer = null; // an unpicked blessing wilts when the wave is sent
  state.wave += 1;
  state.schedule = state.mode === 'endless'
    ? endlessSchedule(state.wave)
    : waveSchedule(state.wave);
  state.spawned = 0;
  state.waveTime = 0;
  state.waveLeaks = 0;
  state.blocks = seedBlocks(state);
  state.waveActive = true;
  const names = {
    brute: 'The Blight Brute lumbers in!',
    titan: 'THE ROT PUMPKIN — final stand!',
  };
  const special = state.schedule.find((s) => names[s.type]);
  if (isSeasonTurnWave(state.wave)) {
    // A new season opens this wave: the banner heralds the turn of
    // the year (boss news rides along as the sub-line when both land).
    const season = seasonForWave(state.wave);
    banner(state, season.icon + ' ' + season.name.toUpperCase() + ' ARRIVES',
      special ? names[special.type]
        : 'Wave ' + state.wave + (state.mode === 'endless' ? '' : ' / ' + TOTAL_WAVES) +
          ' — the garden turns', 2.4);
  } else {
    banner(state, state.mode === 'endless'
        ? '♾ Everbloom — Wave ' + state.wave
        : '🌼 MISSION ' + state.wave + ' — DEFEND THE BLOOM!',
      special ? names[special.type] : '', 2.0);
  }
  if (state.soundOn) sfx.horn();
  return true;
}

function finishWave(state) {
  state.waveActive = false;
  const bonus = 20 + state.wave * 2;
  const interest = Math.min(state.mods.interestCap, Math.floor(state.pollen * 0.05));
  state.pollen += bonus + interest;
  state.earned += bonus + interest;
  state.score += 100 + state.wave * 25;
  state.spinsLeft = SPINS_PER_BREAK; // the slot refills each break
  if (state.waveLeaks === 0) state.flawless += 1; // a leak-free clear
  // Arcade mission rank for the clear: S for flawless, then A/B/C as
  // leaks mount. Score-only, like the quests — balance never moves.
  const rank = state.waveLeaks === 0 ? 'S' : state.waveLeaks === 1 ? 'A'
    : state.waveLeaks === 2 ? 'B' : 'C';
  state.ranks[rank] = (state.ranks[rank] || 0) + 1;
  state.lastRank = rank;
  const rankBonus = rank === 'S' ? 150 : rank === 'A' ? 75 : rank === 'B' ? 25 : 0;
  state.score += rankBonus;
  state.bonusScore += rankBonus;
  checkQuests(state); // wave-clear trials settle before the offer opens
  if (state.spinBuff) {
    // A Bee Frenzy covers exactly the wave that followed its win.
    state.spinBuff.wavesLeft -= 1;
    if (state.spinBuff.wavesLeft <= 0) {
      state.spinBuff = null;
      log(state, 'The Bee Frenzy fades.');
    }
  }
  if (state.mode === 'endless') {
    // Everbloom never wins: the bonus grows with depth, a blessing is
    // offered, and the blight returns on the player's word.
    state.score += endlessClearBonus(state.wave);
    state.offer = rollOffer(state.offerRng);
    log(state, 'Everbloom wave ' + state.wave + ' cleared! Bonus +' + bonus +
      ' pollen, interest +' + interest + '. Choose a blessing!');
    banner(state, '🚩 WAVE CLEAR — RANK ' + rank + '!',
      '+' + (bonus + interest) + ' pollen · rank bonus +' + rankBonus, 1.6);
    if (state.soundOn) sfx.coin();
    return;
  }
  if (state.wave >= TOTAL_WAVES) {
    winGame(state);
    return;
  }
  // The garden offers a blessing before the next wave.
  state.offer = rollOffer(state.offerRng);
  log(state, 'Wave ' + state.wave + ' cleared! Bonus +' + bonus +
    ' pollen, interest +' + interest + '. Choose a blessing!');
  banner(state, '🚩 MISSION CLEAR — RANK ' + rank + '!',
    '+' + (bonus + interest) + ' pollen · rank bonus +' + rankBonus, 1.6);
  if (state.soundOn) sfx.coin();
}

function winGame(state) {
  state.phase = 'won';
  state.score += state.lives * 250 + state.pollen * 2;
  state.overStats = snapshotStats(state);
  if (state.soundOn) sfx.win();
}

/** Everbloom: from the victory screen, keep the garden — towers,
 * blessings, lives, pollen, score — and let the blight return in
 * endless waves. From here the run is a score chase. */
export function enterEndless(state) {
  if (state.phase !== 'won' || state.mode !== 'campaign') return false;
  state.mode = 'endless';
  state.phase = 'play';
  state.overStats = null;
  state.offer = null;
  banner(state, '♾ EVERBLOOM',
    'The blight returns, stronger every wave. How long can the garden hold?', 3.0);
  log(state, 'Everbloom begins — endless waves from wave 25 on. Chase the score!');
  if (state.soundOn) sfx.horn();
  return true;
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
    mode: state.mode,
    spins: state.spinsTaken,
    quests: state.questsDone.length,
    ranks: state.ranks,
    blocks: state.blocksHit,
  };
}

/* --- Combat --- */

export function hitEnemy(state, enemy, rawDamage, source, extra = {}) {
  if (enemy.dead || enemy.reached) return;
  const dmg = Math.max(1, rawDamage - enemy.def.armor);
  enemy.hp -= dmg;
  enemy.flashUntil = state.time + 0.07;
  if (state.particles.length < 600) hitSpark(state, enemy.x, enemy.y, '#fff6d8');
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
  if (enemy.def.boss) state.bossKills += 1;
  if (source) source.kills += 1;
  const bounty = Math.round(enemy.def.bounty * state.mods.bounty);
  state.pollen += bounty;
  state.earned += bounty;
  state.score += enemy.def.bounty * 10 + state.wave * 2;
  burst(state, enemy.x, enemy.y, enemy.def.color, enemy.def.boss ? 30 : 9,
    enemy.def.boss ? 200 : 110, 0.6, 4);
  sparkle(state, enemy.x, enemy.y - 6, '#ffd94d');
  if (enemy.def.boss) {
    banner(state, enemy.def.name + ' felled!', '+' + bounty + ' pollen', 2.4);
    floater(state, enemy.x, enemy.y - 30, '+' + bounty, '#ffd94d');
  }
  if (state.soundOn) sfx.pop();
  if (enemy.def.explodes) {
    // A compost barrel goes up: a fat orange burst, a BOOM floater,
    // a shake, and real AoE damage to every bug in the splash —
    // barrels chain into each other, garden-arcade style.
    burst(state, enemy.x, enemy.y, '#ff9d5c', 26, 190, 0.7, 4.5);
    burst(state, enemy.x, enemy.y, '#ffd94d', 14, 120, 0.5, 3);
    floater(state, enemy.x, enemy.y - 34, 'BOOM!', '#ffb340');
    state.shake = 0.3;
    for (const e of [...state.enemies]) {
      if (e !== enemy && !e.dead && !e.def.barrel &&
          Math.hypot(e.x - enemy.x, e.y - enemy.y) <= 96) {
        hitEnemy(state, e, enemy.def.explodes, null);
      }
    }
  }
  if (enemy.def.splitsInto) {
    for (let i = 0; i < enemy.def.splitCount; i++) {
      const child = makeEnemy(enemy.def.splitsInto, hpMulFor(state),
        enemy.x + (i === 0 ? -10 : 10), enemy.y + (i === 0 ? 6 : -6), state.rng);
      child.wp = enemy.wp;
      child.dist = enemy.dist - 1 - i;
      state.enemies.push(child);
    }
  }
  checkQuests(state); // a pop — or a boss falling — may close a trial
}

function leakEnemy(state, enemy) {
  enemy.reached = true;
  state.lives -= enemy.def.damage;
  state.leaks += 1;
  state.waveLeaks += 1;
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
    const stats = towerStats(tower.type, tower.level, effectiveMods(state));
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
        const child = makeEnemy(e.def.sheds, hpMulFor(state), e.x - 14, e.y + 8, state.rng);
        child.wp = e.wp;
        child.dist = e.dist - 2;
        state.enemies.push(child);
      }
    }
  }
  state.enemies = state.enemies.filter((e) => !e.dead && !e.reached);
}

/* --- Main step --- */

/** Park a freshly spawned compost barrel partway along the path
 * (it never walks, so spawning it at the gate would strand it off
 * the field's edge). Early barrels sit shallow, late ones deep. */
function parkOnPath(state, e, distPx) {
  let rem = distPx;
  const pts = state.waypoints;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (rem <= seg) {
      const k = seg ? rem / seg : 0;
      e.x = a.x + (b.x - a.x) * k;
      e.y = a.y + (b.y - a.y) * k;
      e.wp = i + 1;
      e.dist = distPx;
      return;
    }
    rem -= seg;
  }
}

export function stepWorld(state) {
  const dt = STEP;
  state.time += dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
  if (state.banner && state.time > state.banner.until) state.banner = null;
  if (state.phase === 'play') settleSpinNow(state);

  if (state.phase === 'play' && state.waveActive) {
    state.waveTime += dt;
    while (state.spawned < state.schedule.length &&
           state.schedule[state.spawned].at <= state.waveTime) {
      const item = state.schedule[state.spawned];
      const start = state.waypoints[0];
      const e = makeEnemy(item.type, hpMulFor(state), start.x, start.y, state.rng);
      if (item.type === 'barrel') parkOnPath(state, e, item.at < 20 ? 800 : 1900);
      state.enemies.push(e);
      state.spawned += 1;
    }
    // Mystery Seed Blocks pop when a marching bug bumps them:
    // score and a gold sparkle, never pollen — balance stays put.
    for (const b of state.blocks) {
      if (b.hit) continue;
      if (state.enemies.some((e) => !e.dead &&
          Math.hypot(e.x - b.x, e.y - b.y) < 52)) {
        b.hit = true;
        state.blocksHit += 1;
        state.score += 40;
        state.bonusScore += 40;
        floater(state, b.x, b.y - 18, '+40', '#ffd94d');
        sparkle(state, b.x, b.y, '#ffd94d');
      }
    }
    if (state.spawned >= state.schedule.length && state.enemies.length === 0) {
      finishWave(state);
    }
  }

  if (state.phase === 'play' || state.phase === 'title') {
    stepEnemies(state, dt);
    stepTowers(state, dt);
    stepProjectiles(state, dt, hitEnemy);
    // Ambient life: a drifting spore or firefly every third of a second.
    state.moteTimer -= dt;
    if (state.moteTimer <= 0 && state.particles.length < 500) {
      state.moteTimer = 0.33;
      mote(state,
        8 + state.rng() * 1024,
        62 + state.rng() * 640);
    }
  }
  stepParticles(state, dt);
}

export { TOTAL_WAVES, WAVES };

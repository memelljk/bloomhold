// Particles and floating text: pollen sparkles on a kill, petal bursts on
// a hit, a soft poof when a bug pops, "-1 ♥" when one reaches the bloom.
// Pure decoration — nothing here touches the rules.

import { randRange } from './random.js';

export function burst(state, x, y, color, n, speed = 90, life = 0.5, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = state.rng() * Math.PI * 2;
    const v = randRange(state.rng, speed * 0.3, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 20,
      life: randRange(state.rng, life * 0.5, life),
      maxLife: life,
      size: randRange(state.rng, size * 0.5, size * 1.4),
      color,
      gravity: 60,
    });
  }
}

export function sparkle(state, x, y, color) {
  state.particles.push({
    x: x + randRange(state.rng, -8, 8),
    y: y + randRange(state.rng, -8, 8),
    vx: randRange(state.rng, -12, 12),
    vy: randRange(state.rng, -34, -14),
    life: randRange(state.rng, 0.5, 0.9),
    maxLife: 0.9,
    size: randRange(state.rng, 1.5, 3),
    color,
    gravity: -10,
  });
}

export function floater(state, x, y, text, color) {
  state.floaters.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
}

/** Tiny bright sparks on every landed hit — the "juice" that makes a
 * busy fight read as impacts, not just drifting projectiles. */
export function hitSpark(state, x, y, color) {
  for (let i = 0; i < 3; i++) {
    const a = state.rng() * Math.PI * 2;
    const v = randRange(state.rng, 30, 95);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 12,
      life: randRange(state.rng, 0.14, 0.3),
      maxLife: 0.3,
      size: randRange(state.rng, 1.2, 2.4),
      color,
      gravity: 30,
    });
  }
}

/** One slow ambient mote: a drifting spore / firefly that keeps even a
 * quiet frame alive. Long life, gentle upward drift, soft colours. */
export function mote(state, x, y) {
  const colors = ['#ffe9a8', '#d8f7b0', '#ffd1e8', '#fff6d8'];
  state.particles.push({
    x, y,
    vx: randRange(state.rng, -9, 9),
    vy: randRange(state.rng, -13, -4),
    life: randRange(state.rng, 2.6, 4.2),
    maxLife: 4.2,
    size: randRange(state.rng, 1.4, 2.6),
    color: colors[Math.floor(state.rng() * colors.length)],
    gravity: -3,
  });
}

export function stepParticles(state, dt) {
  const ps = state.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) { ps.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  const fs = state.floaters;
  for (let i = fs.length - 1; i >= 0; i--) {
    const f = fs[i];
    f.life -= dt;
    f.y -= 26 * dt;
    if (f.life <= 0) fs.splice(i, 1);
  }
  // Lightning bolts and other short-lived effects live in state.effects.
  const es = state.effects;
  for (let i = es.length - 1; i >= 0; i--) {
    es[i].life -= dt;
    if (es[i].life <= 0) es.splice(i, 1);
  }
}

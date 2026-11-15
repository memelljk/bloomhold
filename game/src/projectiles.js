// Projectiles: petals fly straight at a locked target, frost shards burst
// into a slowing chill, thorns lob in an arc and splash where they land,
// bees home in and sting (poison). Storm Orchid lightning is instant — it
// never becomes a projectile; world.js applies it directly and leaves a
// bolt effect for the renderer.

import { burst } from './particles.js';

export function fireProjectile(state, tower, stats, target) {
  const kind = stats.kind;
  if (kind === 'petal') {
    state.projectiles.push({
      kind, x: tower.x, y: tower.y - 14, target,
      speed: 430, damage: stats.damage, source: tower,
      color: stats.petalColor, radius: 5,
    });
  } else if (kind === 'frost') {
    state.projectiles.push({
      kind, x: tower.x, y: tower.y - 14, target,
      speed: 360, damage: stats.damage, source: tower,
      color: stats.petalColor, radius: 6,
      splash: stats.splash, slowFactor: stats.slowFactor, slowSeconds: stats.slowSeconds,
    });
  } else if (kind === 'thorn') {
    // Lobbed: remember the launch point and flight time; position is
    // interpolated with a parabolic arc in stepProjectiles.
    const dx = target.x - tower.x;
    const dy = target.y - tower.y;
    const dist = Math.hypot(dx, dy);
    state.projectiles.push({
      kind, x: tower.x, y: tower.y - 16,
      sx: tower.x, sy: tower.y - 16,
      tx: target.x, ty: target.y, target,
      flight: Math.max(0.25, dist / 330), t: 0,
      damage: stats.damage, source: tower,
      color: stats.petalColor, radius: 6, splash: stats.splash,
    });
  } else if (kind === 'bee') {
    state.projectiles.push({
      kind, x: tower.x + (state.rng() - 0.5) * 16, y: tower.y - 18, target,
      speed: 300, damage: stats.damage, source: tower,
      color: stats.petalColor, radius: 4,
      poisonDps: stats.poisonDps, poisonSeconds: stats.poisonSeconds,
      wobble: state.rng() * Math.PI * 2,
    });
  }
}

function moveToward(p, tx, ty, maxStep) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d <= maxStep || d === 0) {
    p.x = tx; p.y = ty;
    return true;
  }
  p.x += (dx / d) * maxStep;
  p.y += (dy / d) * maxStep;
  return false;
}

export function stepProjectiles(state, dt, hitEnemy) {
  const ps = state.projectiles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    if (p.kind === 'thorn') {
      p.t += dt;
      const k = Math.min(1, p.t / p.flight);
      // Track the target while it lives; otherwise land where it was.
      if (p.target && !p.target.dead && !p.target.reached) {
        p.tx = p.target.x; p.ty = p.target.y;
      }
      p.x = p.sx + (p.tx - p.sx) * k;
      p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * 46;
      if (k >= 1) {
        ps.splice(i, 1);
        // Splash: everything in the radius takes the hit.
        for (const e of state.enemies) {
          if (e.dead || e.reached || e.def.flying) continue;
          if (Math.hypot(e.x - p.tx, e.y - p.ty) <= p.splash + e.def.radius) {
            hitEnemy(state, e, p.damage, p.source);
          }
        }
        burst(state, p.tx, p.ty, '#a8e063', 8, 110, 0.4, 3.5);
      }
      continue;
    }
    const target = p.target;
    if (!target || target.dead || target.reached) {
      ps.splice(i, 1);
      continue;
    }
    const arrived = moveToward(p, target.x, target.y, p.speed * dt);
    if (p.kind === 'bee') {
      p.wobble += dt * 18;
      p.x += Math.cos(p.wobble) * 14 * dt;
      p.y += Math.sin(p.wobble * 1.3) * 10 * dt;
    }
    if (arrived) {
      ps.splice(i, 1);
      if (p.kind === 'frost') {
        for (const e of state.enemies) {
          if (e.dead || e.reached) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) <= p.splash + e.def.radius) {
            hitEnemy(state, e, p.damage, p.source, {
              slowFactor: p.slowFactor, slowSeconds: p.slowSeconds,
            });
          }
        }
        burst(state, p.x, p.y, '#9be7ff', 9, 90, 0.45, 3);
      } else if (p.kind === 'bee') {
        hitEnemy(state, target, p.damage, p.source, {
          poisonDps: p.poisonDps, poisonSeconds: p.poisonSeconds,
        });
      } else {
        hitEnemy(state, target, p.damage, p.source);
        burst(state, p.x, p.y, p.color, 3, 60, 0.3, 2.5);
      }
    }
  }
}

// All drawing. The renderer only reads state (plus state.ui, where
// it leaves the button rectangles input.js hit-tests): field, path,
// Heartbloom, towers, bugs, HUD, sidebar, panels and screens.

import {
  W, H, HUD_H, FIELD_X, FIELD_Y, CELL, COLS, ROWS, FIELD_W, FIELD_H,
  FIELD_BOTTOM, SIDE_X, SIDE_W, LOG_Y, HEART_CELL, COLORS, cellCenter, cellAt,
} from './config.js';
import { TOWERS, TOWER_ORDER, towerStats, upgradeCost, sellValue, MAX_LEVEL } from './towers.js';
import { TOTAL_WAVES, wavePreview } from './waves.js';
import { BLESSINGS } from './blessings.js';
import { endlessPreview } from './endless.js';
import { seasonForWave, isSeasonEndWave } from './seasons.js';
import { bugGuide, towerGuide } from './guide.js';
import { QUESTS, questNow } from './quests.js';
import { PAYTABLE, SPIN_COST, reelDisplay } from './luckyspin.js';
import { makeRng } from './random.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, font, color, align = 'left', baseline = 'alphabetic') {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
}

/* --- Field --- */

function drawField(ctx, state) {
  const season = seasonForWave(state.wave);
  // Grass: two-tone mowed checker in the season's palette, broken up
  // by soft tonal patches so no cell reads as flat vector fill (fixed
  // seed: identical each frame).
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (c + r) % 2 === 0 ? season.grassA : season.grassB;
      ctx.fillRect(FIELD_X + c * CELL, FIELD_Y + r * CELL, CELL, CELL);
    }
  }
  const patch = makeRng(4242);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const roll = patch();
      if (roll < 0.42) continue;
      const px = FIELD_X + c * CELL + 10 + patch() * 44;
      const py = FIELD_Y + r * CELL + 10 + patch() * 44;
      ctx.fillStyle = roll < 0.72 ? 'rgba(38, 84, 30, 0.13)' : 'rgba(196, 232, 150, 0.10)';
      ctx.beginPath();
      ctx.ellipse(px, py, 13 + patch() * 17, 8 + patch() * 10, patch() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Decor (positions fixed at world birth), restyled by the season:
  // summer blooms swell, autumn ambers, winter snows.
  let decorIdx = 0;
  for (const d of state.decor) {
    ctx.save();
    ctx.translate(d.x, d.y);
    const sMul = season.id === 'summer' && d.kind === 'flower' ? 1.18 : 1;
    ctx.scale(d.s * sMul, d.s * sMul);
    if (d.kind === 'tuft') {
      ctx.strokeStyle = season.id === 'autumn' ? '#c98f3d'
        : season.id === 'winter' ? '#7d94a6' : season.grassDark;
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 4, 4);
        ctx.quadraticCurveTo(i * 5, -3, i * 7, -7);
        ctx.stroke();
      }
    } else if (d.kind === 'flower') {
      ctx.fillStyle = season.id === 'autumn' ? '#e8863a' : d.color;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 3.4, Math.sin(a) * 3.4, 2.6, 1.7, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffb340';
      ctx.beginPath(); ctx.arc(0, 0, 1.9, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'bush') {
      // A low leafy mound: three dark blobs, light flecks, one bloom.
      ctx.fillStyle = '#3e7a2e';
      for (const [bx, by, br] of [[-6, 2, 6.5], [5, 3, 7.5], [0, -3, 6]]) {
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#5da24b';
      for (const [bx, by] of [[-4, -2], [3, 0], [0, 4]]) {
        ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.arc(4.5, -4.5, 2.4, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'clover') {
      ctx.fillStyle = '#4c9440';
      for (const [bx, by] of [[-3.4, 1.5], [3.4, 1.5], [0, -3]]) {
        ctx.beginPath(); ctx.arc(bx, by, 3.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(-1, -1.5, 1.1, 0, Math.PI * 2); ctx.fill();
    } else if (d.kind === 'mushroom') {
      ctx.fillStyle = '#f3e6cf';
      ctx.fillRect(-1.6, -1, 3.2, 5.5);
      ctx.fillStyle = '#d95f43';
      ctx.beginPath(); ctx.arc(0, -1, 5.6, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [bx, by] of [[-2.4, -3.4], [1.8, -4.4], [0.4, -2.2]]) {
        ctx.beginPath(); ctx.arc(bx, by, 1.05, 0, Math.PI * 2); ctx.fill();
      }
    } else if (d.kind === 'pebbles') {
      ctx.fillStyle = 'rgba(96, 96, 84, 0.55)';
      for (const [bx, by, br] of [[-4, 2, 3], [1, 3.4, 2.4], [4.4, 0.6, 2.8]]) {
        ctx.beginPath(); ctx.ellipse(bx, by, br, br * 0.7, 0.3, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(90, 90, 80, 0.5)';
      ctx.beginPath(); ctx.ellipse(0, 0, 5, 3.6, 0.4, 0, Math.PI * 2); ctx.fill();
    }
    if (season.id === 'winter' && decorIdx % 5 < 2 && d.kind !== 'pebbles') {
      // A dusting of snow settles on two pieces in five.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath(); ctx.ellipse(0, -3.5, 4.6, 1.9, 0, 0, Math.PI * 2); ctx.fill();
    }
    decorIdx++;
    ctx.restore();
  }
  // Dirt path: wide edge pass, main pass, speckles.
  const pts = state.waypoints;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = COLORS.pathEdge;
  ctx.lineWidth = 46;
  tracePath(ctx, pts);
  ctx.strokeStyle = COLORS.path;
  ctx.lineWidth = 38;
  tracePath(ctx, pts);
  const speckle = makeRng(777);
  ctx.fillStyle = COLORS.pathStone;
  for (let i = 0; i < 130; i++) {
    // Walk a random segment and dot a stone on it.
    const seg = Math.floor(speckle() * (pts.length - 1));
    const k = speckle();
    const x = pts[seg].x + (pts[seg + 1].x - pts[seg].x) * k + (speckle() - 0.5) * 26;
    const y = pts[seg].y + (pts[seg + 1].y - pts[seg].y) * k + (speckle() - 0.5) * 26;
    ctx.beginPath(); ctx.arc(x, y, 1.6 + speckle() * 1.8, 0, Math.PI * 2); ctx.fill();
  }
  // Path dressing: tiny blooms and tufts sprouting along both edges of
  // the dirt, so the path reads as worn into a living garden.
  const dress = makeRng(90210);
  const dressColors = ['#ff8fb3', '#ffd94d', '#ffffff', '#c9a0ff'];
  for (let i = 0; i < 110; i++) {
    const seg = Math.floor(dress() * (pts.length - 1));
    const a = pts[seg];
    const b = pts[seg + 1];
    const k = dress();
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const side = dress() < 0.5 ? -1 : 1;
    const off = 25 + dress() * 9;
    const x = a.x + dx * k + (-dy / len) * side * off;
    const y = a.y + dy * k + (dx / len) * side * off;
    if (x < FIELD_X + 6 || x > FIELD_X + FIELD_W - 6 ||
        y < FIELD_Y + 6 || y > FIELD_Y + FIELD_H - 6) continue;
    if (dress() < 0.55) {
      ctx.fillStyle = dressColors[Math.floor(dress() * dressColors.length)];
      for (let p = 0; p < 4; p++) {
        const ang = (p / 4) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(ang) * 2.6, y + Math.sin(ang) * 2.6, 2.1, 1.4, ang, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffb340';
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(58, 110, 44, 0.9)';
      ctx.lineWidth = 1.6;
      for (let s = -1; s <= 1; s++) {
        ctx.beginPath();
        ctx.moveTo(x + s * 3, y + 3);
        ctx.quadraticCurveTo(x + s * 4, y - 2, x + s * 5.5, y - 5.5);
        ctx.stroke();
      }
    }
  }
  drawFarmProps(ctx, state, season);
  // Sunlight wash from the top-left and a soft vignette at the edges.
  const sun = ctx.createLinearGradient(FIELD_X, FIELD_Y, FIELD_X + FIELD_W, FIELD_Y + FIELD_H);
  sun.addColorStop(0, 'rgba(255, 244, 190, 0.07)');
  sun.addColorStop(0.5, 'rgba(255, 244, 190, 0)');
  sun.addColorStop(1, 'rgba(10, 26, 8, 0.08)');
  ctx.fillStyle = sun;
  ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
  const vig = ctx.createRadialGradient(
    FIELD_X + FIELD_W / 2, FIELD_Y + FIELD_H / 2, FIELD_H * 0.42,
    FIELD_X + FIELD_W / 2, FIELD_Y + FIELD_H / 2, FIELD_H * 0.86);
  vig.addColorStop(0, 'rgba(8, 18, 6, 0)');
  vig.addColorStop(1, 'rgba(8, 18, 6, 0.16)');
  ctx.fillStyle = vig;
  ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
  // The season's own light over everything, and its weather in the air.
  ctx.fillStyle = season.tint;
  ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
  drawWeather(ctx, state, season);
  // Field frame.
  ctx.strokeStyle = 'rgba(30, 48, 24, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
}

/** The farm, drawn from fixed geometry: season-following crop rows,
 * a fence, the farmhouse, a scarecrow, a watering can — and one hen
 * who wanders the farmyard, a pure function of time. */
function drawFarmProps(ctx, state, season) {
  const t = state.time;
  // Crop rows, bottom-left: tilled soil with the season's planting —
  // spring sprouts, summer tall crops, autumn pumpkins, winter rest.
  const cx0 = FIELD_X + 4;
  const cy0 = FIELD_Y + 8 * CELL + 6;
  const cw = 2.9 * CELL;
  const chh = 2 * CELL - 12;
  ctx.fillStyle = season.id === 'winter' ? 'rgba(122, 106, 84, 0.5)' : 'rgba(122, 90, 56, 0.55)';
  rr(ctx, cx0, cy0, cw, chh, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(70, 50, 28, 0.5)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx0 + 8, cy0 + (chh / 4) * i);
    ctx.lineTo(cx0 + cw - 8, cy0 + (chh / 4) * i);
    ctx.stroke();
  }
  const crop = makeRng(31337);
  for (let i = 0; i < 26; i++) {
    const px = cx0 + 12 + crop() * (cw - 24);
    const py = cy0 + 10 + crop() * (chh - 20);
    if (season.id === 'autumn') {
      ctx.fillStyle = '#e8863a';
      ctx.beginPath(); ctx.arc(px, py, 4.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4e7a35';
      ctx.fillRect(px - 0.8, py - 6.4, 1.6, 2.6);
    } else if (season.id === 'winter') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(px, py, 4.6, 1.7, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      const tall = season.id === 'summer' ? 1.5 : 1;
      ctx.strokeStyle = '#3e7a2e';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(px, py + 3); ctx.lineTo(px, py - 3 * tall); ctx.stroke();
      ctx.fillStyle = '#5da24b';
      ctx.beginPath(); ctx.ellipse(px - 2.6, py - 3 * tall, 2.8, 1.4, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px + 2.6, py - 3.4 * tall, 2.8, 1.4, 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Wooden fence runs along the top and bottom edges of the field.
  ctx.strokeStyle = '#8a6844';
  ctx.lineWidth = 2.6;
  for (const fy of [FIELD_Y + 5, FIELD_BOTTOM - 6]) {
    ctx.beginPath(); ctx.moveTo(FIELD_X + 6, fy); ctx.lineTo(FIELD_X + FIELD_W - 6, fy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(FIELD_X + 6, fy + 6); ctx.lineTo(FIELD_X + FIELD_W - 6, fy + 6); ctx.stroke();
    ctx.fillStyle = '#a87f4f';
    for (let i = 0; i < 22; i++) {
      const fx = FIELD_X + 14 + i * 46;
      if (fy < FIELD_Y + 100 && fx > FIELD_X + FIELD_W - 190) continue; // farmhouse gap
      ctx.fillRect(fx, fy - 3, 4.4, 13);
    }
  }
  // The farmhouse corner, top-right: cream walls, terracotta roof.
  const hx = FIELD_X + FIELD_W - 168;
  const hy = FIELD_Y + 6;
  ctx.fillStyle = '#f3e6cf';
  ctx.fillRect(hx + 14, hy + 22, 132, 34);
  ctx.fillStyle = '#b3541e';
  ctx.beginPath();
  ctx.moveTo(hx + 4, hy + 24); ctx.lineTo(hx + 80, hy + 2); ctx.lineTo(hx + 156, hy + 24);
  ctx.closePath(); ctx.fill();
  if (season.id === 'winter') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(hx + 26, hy + 15); ctx.lineTo(hx + 80, hy + 2); ctx.lineTo(hx + 134, hy + 15);
    ctx.lineTo(hx + 118, hy + 16); ctx.lineTo(hx + 80, hy + 7); ctx.lineTo(hx + 42, hy + 16);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#8a6844';
  ctx.fillRect(hx + 106, hy + 6, 10, 14); // chimney
  ctx.fillStyle = '#6d4c2f';
  ctx.fillRect(hx + 68, hy + 36, 18, 20); // door
  ctx.fillStyle = '#ffd94d';
  ctx.fillRect(hx + 28, hy + 32, 16, 13); // lit window
  ctx.strokeStyle = '#8a6844'; ctx.lineWidth = 1.6;
  ctx.strokeRect(hx + 28, hy + 32, 16, 13);
  if (season.id === 'autumn') {
    ctx.fillStyle = '#e8863a';
    for (const px of [hx + 20, hx + 34]) {
      ctx.beginPath(); ctx.arc(px, hy + 52, 5.4, 0, Math.PI * 2); ctx.fill();
    }
  } else if (season.id === 'spring' || season.id === 'summer') {
    ctx.fillStyle = '#ff8fb3';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(hx + 24 + i * 9, hy + 52, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  // A scarecrow keeps the middle bend, straw hat and all.
  const sc = cellCenter(13, 2);
  ctx.strokeStyle = '#6d4c2f'; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(sc.x, sc.y + 20); ctx.lineTo(sc.x, sc.y - 12); ctx.stroke();
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(sc.x - 15, sc.y - 4); ctx.lineTo(sc.x + 15, sc.y - 8); ctx.stroke();
  ctx.fillStyle = '#7a9ab0';
  ctx.beginPath(); ctx.ellipse(sc.x, sc.y + 4, 8.6, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f3e6cf';
  ctx.beginPath(); ctx.arc(sc.x, sc.y - 17, 6.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b23a';
  ctx.beginPath(); ctx.ellipse(sc.x, sc.y - 21.5, 10.4, 2.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(sc.x - 3.4, sc.y - 27, 6.8, 5);
  ctx.strokeStyle = '#e8b23a'; ctx.lineWidth = 1.6;
  for (const dx of [-13, 13]) {
    ctx.beginPath(); ctx.moveTo(sc.x + dx, sc.y - 5 + (dx < 0 ? 1 : -3));
    ctx.lineTo(sc.x + dx * 1.25, sc.y + 1); ctx.stroke();
  }
  // A watering can rests by the Heartbloom.
  const wc = cellCenter(14, 8);
  const wx = wc.x - 16;
  const wy = wc.y + 15;
  ctx.fillStyle = '#7a9ab0';
  ctx.beginPath(); ctx.ellipse(wx, wy, 9.4, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(wx - 8, wy - 2); ctx.lineTo(wx - 16, wy - 8); ctx.lineTo(wx - 13, wy + 1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5d7d94'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(wx + 8, wy - 4, 5.4, -0.6, 1.8); ctx.stroke();
  ctx.fillStyle = '#5d7d94';
  ctx.fillRect(wx - 17.6, wy - 10.4, 3.6, 3.6); // rose head
  // One hen wanders the farmyard by the crop rows — position and peck
  // are pure functions of time, so she is identical on every replay.
  const henX = FIELD_X + 96 + Math.sin(t * 0.11) * 52;
  const henY = FIELD_Y + 8.55 * CELL + Math.cos(t * 0.073) * 18;
  const facing = Math.cos(t * 0.11) >= 0 ? 1 : -1;
  const peck = Math.max(0, Math.sin(t * 2.1)) > 0.86 ? 3.4 : 0;
  ctx.save();
  ctx.translate(henX, henY);
  ctx.scale(facing, 1);
  ctx.fillStyle = 'rgba(18, 34, 14, 0.22)';
  ctx.beginPath(); ctx.ellipse(0, 6.4, 9, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fdfbf5';
  ctx.beginPath(); ctx.ellipse(0, 0, 9.4, 6.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-3, -1.4, 5.4, 3.8, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e8e2d2'; ctx.lineWidth = 1.8;
  for (const dx of [-8.4, -10]) {
    ctx.beginPath(); ctx.moveTo(dx + 3, -3); ctx.lineTo(dx, -7.4); ctx.stroke();
  }
  ctx.fillStyle = '#fdfbf5';
  ctx.beginPath(); ctx.arc(8.4, -4.6 + peck, 3.9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5d73';
  ctx.beginPath(); ctx.arc(8, -8.6 + peck, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(10.2, -8.2 + peck, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffb340';
  ctx.beginPath(); ctx.moveTo(11.8, -4.4 + peck); ctx.lineTo(15, -3.4 + peck); ctx.lineTo(11.8, -2.6 + peck); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1d2417';
  ctx.beginPath(); ctx.arc(9.4, -5 + peck, 0.85, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Season weather — petals, leaves, snow — on fixed-seed streams
 * advanced by state.time, identical on every replay. */
function drawWeather(ctx, state, season) {
  if (season.weather === 'none') return;
  const t = state.time;
  const rng = makeRng(season.weather === 'snow' ? 7170 : season.weather === 'petals' ? 5150 : 6160);
  const n = season.weather === 'snow' ? 30 : 10;
  for (let i = 0; i < n; i++) {
    const bx = rng() * FIELD_W;
    const by = rng() * FIELD_H;
    const sp = 12 + rng() * 22;
    const ph = rng() * Math.PI * 2;
    if (season.weather === 'snow') {
      const x = FIELD_X + ((bx + t * sp * 0.4 + Math.sin(t * 0.9 + ph) * 9) % FIELD_W);
      const y = FIELD_Y + ((by + t * sp) % FIELD_H);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath(); ctx.arc(x, y, 1.7, 0, Math.PI * 2); ctx.fill();
    } else {
      const x = FIELD_X + ((bx + t * sp * 0.8) % FIELD_W);
      const y = FIELD_Y + ((by + t * sp * 0.55 + Math.sin(t * 1.3 + ph) * 7) % FIELD_H);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 1.7 + ph);
      ctx.fillStyle = season.weather === 'petals' ? 'rgba(255, 183, 213, 0.85)' : 'rgba(216, 120, 50, 0.85)';
      ctx.beginPath(); ctx.ellipse(0, 0, 4.4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

/** The season chip: a small pill at the field's top-left naming the
 * season the current wave is fought in (and Everbloom, when endless). */
function drawSeasonChip(ctx, state) {
  const season = seasonForWave(state.wave);
  const label = season.icon + ' ' + season.name + (state.mode === 'endless' ? ' · ♾ Everbloom' : '');
  ctx.font = '700 12.5px system-ui, sans-serif';
  const w = ctx.measureText(label).width + 22;
  const x = FIELD_X + 10;
  const y = FIELD_Y + 10;
  ctx.fillStyle = 'rgba(20, 30, 16, 0.74)';
  rr(ctx, x, y, w, 25, 12); ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 1.2; ctx.stroke();
  text(ctx, label, x + w / 2, y + 17, '700 12.5px system-ui, sans-serif', COLORS.text, 'center');
}

function tracePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function drawHeartbloom(ctx, state) {
  const { x, y } = cellCenter(HEART_CELL.c, HEART_CELL.r);
  const pulse = 1 + Math.sin(state.time * 2.4) * 0.05;
  const glow = ctx.createRadialGradient(x, y, 4, x, y, 52 * pulse);
  glow.addColorStop(0, 'rgba(255, 120, 150, 0.5)');
  glow.addColorStop(1, 'rgba(255, 120, 150, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, 52 * pulse, 0, Math.PI * 2); ctx.fill();
  // Petals.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  for (let layer = 0; layer < 2; layer++) {
    const n = layer === 0 ? 8 : 6;
    const rad = layer === 0 ? 17 : 11;
    const len = layer === 0 ? 13 : 10;
    ctx.fillStyle = layer === 0 ? '#ff8fab' : '#ffc2d4';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + layer * 0.4 + state.time * 0.15;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * rad, Math.sin(a) * rad, len, 6.5, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5d73';
  drawHeart(ctx, 0, 1, 5.5);
  ctx.restore();
  // Orbiting pollen sparkles around the bloom.
  for (let i = 0; i < 6; i++) {
    const a = state.time * 0.9 + (i * Math.PI * 2) / 6;
    const rad = 30 + Math.sin(state.time * 1.7 + i * 2.1) * 6;
    ctx.fillStyle = i % 2 ? 'rgba(255, 217, 77, 0.85)' : 'rgba(255, 194, 212, 0.85)';
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.82, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  text(ctx, '♥ ' + Math.max(0, state.lives), x, y + 44, '700 14px system-ui, sans-serif',
    COLORS.heart, 'center');
  // The mission flag over the Heartbloom, coloured by the last
  // wave's clear rank — gold for an S, raised the moment it lands.
  const flagCols = { S: '#ffd94d', A: '#7ee787', B: '#7ec8ff', C: '#d8d8d8' };
  const fx = x + 30;
  ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(fx, y - 2); ctx.lineTo(fx, y - 42); ctx.stroke();
  ctx.fillStyle = flagCols[state.lastRank] || '#ff8fab';
  const wv = Math.sin(state.time * 3) * 2;
  ctx.beginPath();
  ctx.moveTo(fx, y - 42); ctx.lineTo(fx + 17, y - 36 + wv); ctx.lineTo(fx, y - 29);
  ctx.closePath(); ctx.fill();
}

function drawHeart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.2, x - s * 0.7, y - s * 1.3, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.4, y - s * 0.2, x, y + s * 0.9);
  ctx.fill();
}

/* --- Towers --- */

function drawTowerHead(ctx, type, x, y, angle, scale, time, recoil) {
  const def = TOWERS[type];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * (1 + recoil * 0.12), scale * (1 + recoil * 0.12));
  if (type === 'archer') {
    ctx.fillStyle = def.petalColor;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 8, Math.sin(a) * 8, 7.5, 4.4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = def.coreColor;
    ctx.beginPath(); ctx.arc(0, 0, 6.4, 0, Math.PI * 2); ctx.fill();
    // Aiming petal spike.
    ctx.rotate(angle);
    ctx.fillStyle = '#fff0f5';
    ctx.beginPath();
    ctx.moveTo(5, -3.4); ctx.lineTo(16, 0); ctx.lineTo(5, 3.4); ctx.closePath(); ctx.fill();
  } else if (type === 'frost') {
    ctx.fillStyle = def.petalColor;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(3, -4); ctx.lineTo(15, 0); ctx.lineTo(3, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = def.coreColor;
    ctx.beginPath(); ctx.arc(0, 0, 5.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(-1.6, -1.6, 2, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'mortar') {
    ctx.fillStyle = def.coreColor;
    ctx.beginPath(); ctx.arc(0, 0, 11.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = def.petalColor;
    ctx.beginPath(); ctx.arc(-3, -3.4, 6.4, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = '#3d6128';
    rr(ctx, 4, -4.4, 12, 8.8, 4); ctx.fill();
    ctx.restore();
  } else if (type === 'hive') {
    ctx.fillStyle = '#7a9a3d';
    ctx.beginPath(); ctx.ellipse(0, -13, 13, 5.4, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = def.petalColor;
    ctx.beginPath(); ctx.ellipse(0, 1, 10.4, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = def.coreColor;
    ctx.lineWidth = 2;
    for (const yy of [-5, 0.5, 6]) {
      ctx.beginPath(); ctx.ellipse(0, yy, 9.6 - Math.abs(yy) * 0.5, 2.6, 0, 0, Math.PI); ctx.stroke();
    }
    ctx.fillStyle = '#5c430a';
    ctx.beginPath(); ctx.arc(0, 9.4, 3, 0, Math.PI * 2); ctx.fill();
    // Orbiting bees.
    ctx.fillStyle = '#3a3325';
    for (let i = 0; i < 3; i++) {
      const a = time * 2.6 + (i * Math.PI * 2) / 3;
      const bx = Math.cos(a) * 16;
      const by = Math.sin(a) * 7 - 2;
      ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath(); ctx.arc(bx, by, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a3325';
    }
  } else if (type === 'orchid') {
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
    glow.addColorStop(0, 'rgba(167, 139, 250, 0.5)');
    glow.addColorStop(1, 'rgba(167, 139, 250, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = def.petalColor;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 8.4, Math.sin(a) * 8.4, 8, 4.6, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = def.coreColor;
    ctx.beginPath(); ctx.arc(0, 0, 5.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe95e';
    ctx.beginPath(); ctx.arc(0, 0, 2.4 + Math.sin(time * 6) * 0.7, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'sunbloom') {
    ctx.fillStyle = def.petalColor;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.sin(time * 0.8) * 0.05;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 10, Math.sin(a) * 10, 7.6, 3.9, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#8a5a1d';
    ctx.beginPath(); ctx.arc(0, 0, 7.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5c3c10';
    for (const [dx, dy] of [[-2.4, -1.4], [2.4, -1.4], [-2.4, 2.2], [2.4, 2.2], [0, 0.4]]) {
      ctx.beginPath(); ctx.arc(dx, dy, 1.05, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawTower(ctx, state, tower) {
  const { x, y } = tower;
  // Growth stages: level 1 a sprout, 2 a young plant, 3 the full
  // bloom with a sparkle ring (presentation only, stats untouched).
  const growth = [0.68, 0.86, 1][tower.level - 1];
  const headY = y - [5, 8, 10][tower.level - 1];
  // Soft ground shadow, then soil mound + stem.
  ctx.fillStyle = 'rgba(18, 34, 14, 0.28)';
  ctx.beginPath(); ctx.ellipse(x + 5, y + 16, 17, 6.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COLORS.soil;
  ctx.beginPath(); ctx.ellipse(x, y + 13, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (tower.level === 1) {
    // Seed dots still visible on the mound the sprout came from.
    ctx.fillStyle = '#5c430a';
    for (const dx of [-6, 0.5, 6.5]) {
      ctx.beginPath(); ctx.arc(x + dx, y + 12.4, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.strokeStyle = '#4e7a35';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y + 12);
  ctx.quadraticCurveTo(x + 2, y + 4, x, headY + 4);
  ctx.stroke();
  ctx.fillStyle = '#5da24b';
  if (tower.level === 1) {
    // Two small sprout leaves.
    ctx.beginPath(); ctx.ellipse(x - 4.4, y + 7.4, 4.2, 1.9, -0.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 4.4, y + 6.4, 4.2, 1.9, 0.55, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(x - 7, y + 6, 6.4, 3, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 7, y + 4, 6.4, 3, 0.5, 0, Math.PI * 2); ctx.fill();
    if (tower.level === 3) {
      ctx.beginPath(); ctx.ellipse(x - 5.4, y - 0.5, 4.8, 2.2, -0.7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 5.4, y - 1.5, 4.8, 2.2, 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawTowerHead(ctx, tower.type, x, headY, tower.angle, growth, state.time, tower.recoil);
  if (tower.level === 3) {
    // Full bloom: a slow ring of pollen sparkles crowns the tower.
    for (let i = 0; i < 3; i++) {
      const a = state.time * 1.4 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = 'rgba(255, 217, 77, 0.8)';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 15, headY + Math.sin(a) * 6, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Level pips.
  for (let i = 0; i < tower.level; i++) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(x - (tower.level - 1) * 5 + i * 10, y + 21, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.selected === tower) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 24 + Math.sin(state.time * 5) * 1.5, 0, Math.PI * 2); ctx.stroke();
  }
}

/* --- Enemies --- */

/** A compost barrel parked on the path (Everbloom): banded wood, a
 * lit fuse, and a warning glyph. Towers shoot it; it explodes. */
function drawBarrel(ctx, state, e) {
  const { x, y } = e;
  const r = e.def.radius;
  ctx.fillStyle = 'rgba(18, 34, 14, 0.26)';
  ctx.beginPath(); ctx.ellipse(x + 3, y + r * 0.82, r * 0.9, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = state.time < e.flashUntil ? '#e8a06a' : '#b3541e';
  rr(ctx, x - r, y - r, r * 2, r * 2, 7); ctx.fill();
  ctx.strokeStyle = '#6e3410'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.45); ctx.lineTo(x + r, y - r * 0.45); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r, y + r * 0.45); ctx.lineTo(x + r, y + r * 0.45); ctx.stroke();
  ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + 4, y - r - 6, x + 8, y - r - 5); ctx.stroke();
  ctx.fillStyle = '#ffe95e';
  ctx.beginPath();
  ctx.arc(x + 8, y - r - 5, 2.2 + Math.sin(state.time * 11 + e.wobble) * 0.7, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, '💥', x, y + 5, '13px system-ui, sans-serif', COLORS.text, 'center');
  if (e.hp < e.maxHp) {
    const w = Math.max(26, r * 2);
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(15, 20, 12, 0.72)';
    ctx.fillRect(x - w / 2, y - r - 11, w, 5);
    ctx.fillStyle = frac > 0.45 ? '#7ee787' : frac > 0.2 ? '#ffd94d' : '#ff7b72';
    ctx.fillRect(x - w / 2 + 0.5, y - r - 10.5, (w - 1) * frac, 4);
  }
}

/** Mystery Seed Blocks floating beside the path: gold while their
 * bonus sleeps inside, dull once a passing bug has popped them. */
function drawBlocks(ctx, state) {
  for (const b of state.blocks) {
    const by = b.y + Math.sin(state.time * 2.2 + b.ph) * 3;
    ctx.fillStyle = b.hit ? 'rgba(110, 84, 40, 0.55)' : '#f2b63c';
    rr(ctx, b.x - 13, by - 13, 26, 26, 6); ctx.fill();
    ctx.strokeStyle = b.hit ? 'rgba(70, 54, 24, 0.6)' : '#8a6d1d';
    ctx.lineWidth = 1.8; ctx.stroke();
    if (!b.hit) text(ctx, '🌱', b.x, by + 5, '13px system-ui, sans-serif', COLORS.text, 'center');
  }
}

function drawEnemy(ctx, state, e) {
  if (e.def.barrel) { drawBarrel(ctx, state, e); return; }
  const def = e.def;
  const flying = def.flying;
  const bob = flying ? Math.sin(state.time * 9 + e.wobble) * 3 - 16 : 0;
  const x = e.x;
  const y = e.y + bob;
  if (flying) {
    ctx.fillStyle = 'rgba(20, 30, 15, 0.3)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 8, def.radius * 0.8, 4.4, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    // Ground shadow: grounds every bug on the grass.
    ctx.fillStyle = 'rgba(18, 34, 14, 0.26)';
    ctx.beginPath();
    ctx.ellipse(e.x + 3, e.y + def.radius * 0.82, def.radius * 0.88, def.radius * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (def.boss) {
    // A slow menace aura pulsing behind the boss.
    const auraR = def.radius * (2.15 + Math.sin(state.time * 2.2 + e.wobble) * 0.16);
    const aura = ctx.createRadialGradient(e.x, e.y, def.radius * 0.5, e.x, e.y, auraR);
    aura.addColorStop(0, 'rgba(255, 96, 60, 0.30)');
    aura.addColorStop(0.7, 'rgba(190, 50, 60, 0.14)');
    aura.addColorStop(1, 'rgba(190, 50, 60, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(e.x, e.y, auraR, 0, Math.PI * 2); ctx.fill();
  }
  ctx.save();
  ctx.translate(x, y);
  const legSwing = Math.sin(state.time * 10 + e.wobble) * 3;
  ctx.strokeStyle = 'rgba(30, 30, 20, 0.75)';
  ctx.lineWidth = 2;
  if (!flying) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * def.radius * 0.45, def.radius * 0.5);
      ctx.lineTo(i * def.radius * 0.45 + (i === 0 ? legSwing : -legSwing), def.radius * 0.95);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i * def.radius * 0.45, def.radius * 0.5);
      ctx.lineTo(i * def.radius * 0.45 - (i === 0 ? legSwing : -legSwing), def.radius * 0.95);
      ctx.stroke();
    }
  }
  if (e.type === 'wasp') {
    const flap = Math.sin(state.time * 42 + e.wobble) * 0.5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.rotate(s * (0.7 + flap * 0.4));
      ctx.beginPath(); ctx.ellipse(s * 9, -8, 9.5, 3.8, s * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  // Body.
  ctx.fillStyle = def.color;
  ctx.beginPath(); ctx.arc(0, 0, def.radius, 0, Math.PI * 2); ctx.fill();
  if (e.type === 'snail') {
    ctx.fillStyle = def.belly;
    ctx.beginPath(); ctx.arc(-3, -2, def.radius * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(-3, -2, def.radius * 0.36, 0.4, Math.PI * 1.7); ctx.stroke();
    ctx.beginPath(); ctx.arc(-3, -2, def.radius * 0.17, 0.4, Math.PI * 1.7); ctx.stroke();
  } else if (e.type === 'beetle') {
    ctx.strokeStyle = 'rgba(20, 20, 40, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -def.radius); ctx.lineTo(0, def.radius); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, def.radius * 0.66, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, def.radius * 0.66, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  } else if (e.type === 'splitter') {
    ctx.fillStyle = def.belly;
    ctx.beginPath(); ctx.arc(-def.radius * 0.34, 0, def.radius * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(def.radius * 0.34, 0, def.radius * 0.55, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'wasp') {
    ctx.fillStyle = def.belly;
    for (const dx of [-6, 1]) {
      ctx.fillRect(dx, -def.radius + 3, 4.4, def.radius * 2 - 6);
    }
    // Stinger.
    ctx.fillStyle = '#3a3325';
    ctx.beginPath(); ctx.moveTo(-def.radius - 5, 0); ctx.lineTo(-def.radius + 2, -3); ctx.lineTo(-def.radius + 2, 3); ctx.closePath(); ctx.fill();
  } else if (def.boss) {
    // Thorny crown / pumpkin ridges.
    ctx.strokeStyle = 'rgba(40, 20, 5, 0.5)';
    ctx.lineWidth = 3;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * def.radius * 0.36, -def.radius);
      ctx.quadraticCurveTo(i * def.radius * 0.44, 0, i * def.radius * 0.36, def.radius);
      ctx.stroke();
    }
    ctx.fillStyle = '#4e7a35';
    ctx.beginPath(); ctx.ellipse(0, -def.radius - 3, 7, 4, 0.3, 0, Math.PI * 2); ctx.fill();
    // Glowing carved eyes.
    ctx.fillStyle = '#ffe95e';
    ctx.beginPath(); ctx.arc(-def.radius * 0.34, -def.radius * 0.16, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(def.radius * 0.34, -def.radius * 0.16, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffe95e';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-def.radius * 0.4, def.radius * 0.34);
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(-def.radius * 0.4 + (i + 0.5) * def.radius * 0.2, def.radius * 0.2);
      ctx.lineTo(-def.radius * 0.4 + (i + 1) * def.radius * 0.2, def.radius * 0.34);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = def.belly;
    ctx.beginPath(); ctx.ellipse(0, def.radius * 0.3, def.radius * 0.6, def.radius * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (!def.boss && e.type !== 'wasp') {
    // Eyes + antennae.
    ctx.strokeStyle = 'rgba(30,30,20,0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(3, -def.radius * 0.6); ctx.quadraticCurveTo(7, -def.radius - 4, 11, -def.radius - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, -def.radius * 0.6); ctx.quadraticCurveTo(-6, -def.radius - 4, -9, -def.radius - 6); ctx.stroke();
    ctx.fillStyle = '#1d2417';
    ctx.beginPath(); ctx.arc(4.4, -2, 2.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-4.4, -2, 2.1, 0, Math.PI * 2); ctx.fill();
  }
  // Slow / poison tints.
  if (state.time < e.slowUntil) {
    ctx.fillStyle = 'rgba(155, 231, 255, 0.4)';
    ctx.beginPath(); ctx.arc(0, 0, def.radius, 0, Math.PI * 2); ctx.fill();
  }
  if (state.time < e.poisonUntil) {
    ctx.fillStyle = 'rgba(140, 230, 110, 0.35)';
    ctx.beginPath(); ctx.arc(0, 0, def.radius * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  // Hit flash: a white blink in the instant a hit lands.
  if (state.time < e.flashUntil) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath(); ctx.arc(0, 0, def.radius, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // HP bar.
  if (e.hp < e.maxHp) {
    const w = Math.max(26, def.radius * 2);
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(15, 20, 12, 0.72)';
    ctx.fillRect(x - w / 2, y - def.radius - 11, w, 5);
    ctx.fillStyle = frac > 0.45 ? '#7ee787' : frac > 0.2 ? '#ffd94d' : '#ff7b72';
    ctx.fillRect(x - w / 2 + 0.5, y - def.radius - 10.5, (w - 1) * frac, 4);
  }
  if (def.boss) {
    text(ctx, def.name.toUpperCase(), x, y - def.radius - 16,
      '700 11px system-ui, sans-serif', '#ffb340', 'center');
  }
}

/* --- Projectiles, effects, particles --- */

function drawProjectiles(ctx, state) {
  for (const p of state.projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.kind === 'petal') {
      ctx.fillStyle = 'rgba(255, 180, 210, 0.28)';
      ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.ellipse(0, 0, 6.4, 3.6, state.time * 9, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'frost') {
      ctx.fillStyle = 'rgba(155, 231, 255, 0.30)';
      ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(-1.4, -1.4, 2, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'thorn') {
      ctx.fillStyle = 'rgba(20, 30, 15, 0.25)';
      ctx.beginPath(); ctx.ellipse(p.tx - p.x, p.ty - p.y + 6, 8, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5b8c3e';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a8e063';
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(3, 0); ctx.lineTo(-3, 0); ctx.closePath(); ctx.fill();
    } else if (p.kind === 'bee') {
      ctx.fillStyle = '#ffcf4d';
      ctx.beginPath(); ctx.ellipse(0, 0, 5.2, 3.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a3325';
      ctx.fillRect(-1, -3.8, 2.2, 7.6);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(-1, -4.6, 3.6, 2, -0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  for (const fx of state.effects) {
    const a = Math.max(0, fx.life / fx.maxLife);
    ctx.strokeStyle = 'rgba(255, 233, 94, ' + (0.35 + 0.65 * a) + ')';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    fx.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + 0.5 * a + ')';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (const p of state.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const f of state.floaters) {
    const a = Math.max(0, f.life / f.maxLife);
    ctx.globalAlpha = a;
    text(ctx, f.text, f.x, f.y, '700 14px system-ui, sans-serif', f.color, 'center');
  }
  ctx.globalAlpha = 1;
}

/* --- HUD + sidebar --- */

function drawHud(ctx, state) {
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = COLORS.hudEdge;
  ctx.fillRect(0, HUD_H - 2, W, 2);
  text(ctx, '🌼 BLOOMHOLD', 14, 35, '800 19px system-ui, sans-serif', COLORS.text);
  // Pollen.
  ctx.fillStyle = COLORS.pollen;
  ctx.beginPath(); ctx.arc(196, 26, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a6d1d';
  ctx.beginPath(); ctx.arc(196, 26, 3.4, 0, Math.PI * 2); ctx.fill();
  text(ctx, String(Math.floor(state.pollen)), 210, 34, '700 19px ui-monospace, monospace', COLORS.pollen);
  // Lives.
  ctx.fillStyle = COLORS.heart;
  drawHeart(ctx, 330, 24, 9);
  text(ctx, String(Math.max(0, state.lives)), 346, 34, '700 19px ui-monospace, monospace', '#ffb3c0');
  // Wave, with the season it is fought in named beside it.
  text(ctx, 'WAVE', 420, 34, '700 12px system-ui, sans-serif', COLORS.faint);
  const waveStr = state.mode === 'endless'
    ? '♾ ' + state.wave
    : Math.max(1, state.wave) + ' / ' + TOTAL_WAVES;
  text(ctx, waveStr, 462, 35, '700 19px ui-monospace, monospace', COLORS.text);
  ctx.font = '700 19px ui-monospace, monospace';
  const waveEnd = 462 + ctx.measureText(waveStr).width;
  const season = seasonForWave(state.wave);
  text(ctx, season.icon + ' ' + season.name, waveEnd + 12, 34,
    '600 12.5px system-ui, sans-serif', COLORS.dim);
  // Score.
  text(ctx, 'SCORE', 644, 34, '700 12px system-ui, sans-serif', COLORS.faint);
  text(ctx, String(state.score), 692, 35, '700 19px ui-monospace, monospace', COLORS.text);
  // Kills.
  text(ctx, 'BUGS POPPED', 828, 34, '700 12px system-ui, sans-serif', COLORS.faint);
  text(ctx, String(state.kills), 920, 35, '700 19px ui-monospace, monospace', COLORS.text);
  // Buttons: speed, pause, mute.
  const btn = (key, x, label) => {
    const rect = { x, y: 9, w: 62, h: 36 };
    state.ui[key] = rect;
    ctx.fillStyle = COLORS.panelSoft;
    rr(ctx, rect.x, rect.y, rect.w, rect.h, 8); ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 1.5; ctx.stroke();
    text(ctx, label, x + 31, 33, '700 15px system-ui, sans-serif', COLORS.text, 'center');
  };
  btn('speedBtn', 1010, '×' + state.speed);
  btn('pauseBtn', 1082, state.paused ? '▶' : '❚❚');
  btn('muteBtn', 1154, state.muted ? '♪ OFF' : '♪ ON');
}

function drawSidebar(ctx, state) {
  const x = SIDE_X;
  ctx.fillStyle = COLORS.panel;
  rr(ctx, x, FIELD_Y, SIDE_W, FIELD_H, 10); ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 1.5; ctx.stroke();
  text(ctx, 'PLANT A FLOWER', x + 14, FIELD_Y + 24, '800 13px system-ui, sans-serif', COLORS.dim);

  // Shop cards: 2 columns x 3 rows.
  state.ui.shop = {};
  const cw = (SIDE_W - 28 - 8) / 2;
  const ch = 86;
  TOWER_ORDER.forEach((key, i) => {
    const def = TOWERS[key];
    const cx = x + 14 + (i % 2) * (cw + 8);
    const cy = FIELD_Y + 34 + Math.floor(i / 2) * (ch + 8);
    const rect = { x: cx, y: cy, w: cw, h: ch };
    state.ui.shop[key] = rect;
    const afford = state.pollen >= def.cost;
    const sel = state.shopSel === key;
    ctx.fillStyle = sel ? '#3d6128' : COLORS.panelSoft;
    rr(ctx, cx, cy, cw, ch, 8); ctx.fill();
    ctx.strokeStyle = sel ? COLORS.pollen : COLORS.panelEdge;
    ctx.lineWidth = sel ? 2.4 : 1.2; ctx.stroke();
    ctx.save();
    ctx.globalAlpha = afford ? 1 : 0.45;
    drawTowerHead(ctx, key, cx + cw / 2, cy + 26, -Math.PI / 2, 0.92, state.time, 0);
    ctx.restore();
    text(ctx, def.short, cx + cw / 2, cy + 56, '700 12.5px system-ui, sans-serif', COLORS.text, 'center');
    text(ctx, '✿ ' + def.cost, cx + cw / 2, cy + 74, '700 12.5px ui-monospace, monospace',
      afford ? COLORS.pollen : COLORS.bad, 'center');
  });

  const panelY = FIELD_Y + 34 + 3 * (ch + 8) + 6; // 386-ish
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  rr(ctx, x + 10, panelY, SIDE_W - 20, 148, 8); ctx.fill();

  const sel = state.selected;
  if (sel) {
    const def = TOWERS[sel.type];
    const stats = towerStats(sel.type, sel.level, state.mods);
    text(ctx, def.name + '  ·  Lv ' + sel.level, x + 20, panelY + 22,
      '800 13.5px system-ui, sans-serif', COLORS.text);
    text(ctx, 'DMG ' + Math.round(stats.damage) + '   RNG ' + Math.round(stats.range) +
      '   RATE ' + stats.rate.toFixed(1) + '/s', x + 20, panelY + 42,
      '600 11.5px ui-monospace, monospace', COLORS.dim);
    text(ctx, 'Popped ' + sel.kills + ' bugs', x + 20, panelY + 60,
      '600 11.5px system-ui, sans-serif', COLORS.dim);
    const upCost = upgradeCost(sel);
    const bw = (SIDE_W - 48) / 2;
    const upRect = { x: x + 20, y: panelY + 72, w: bw, h: 34 };
    const sellRect = { x: x + 28 + bw, y: panelY + 72, w: bw, h: 34 };
    state.ui.upgradeBtn = upRect;
    state.ui.sellBtn = sellRect;
    ctx.fillStyle = upCost != null && state.pollen >= upCost ? '#3d6128' : 'rgba(0,0,0,0.25)';
    rr(ctx, upRect.x, upRect.y, upRect.w, upRect.h, 7); ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge; ctx.stroke();
    text(ctx, upCost == null ? 'MAX LEVEL' : '▲ Grow ✿' + upCost,
      upRect.x + bw / 2, upRect.y + 22, '700 12.5px system-ui, sans-serif',
      upCost != null && state.pollen >= upCost ? COLORS.text : COLORS.faint, 'center');
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, sellRect.x, sellRect.y, sellRect.w, sellRect.h, 7); ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge; ctx.stroke();
    text(ctx, 'Sell ✿' + sellValue(sel), sellRect.x + bw / 2, sellRect.y + 22,
      '700 12.5px system-ui, sans-serif', COLORS.dim, 'center');
    text(ctx, def.desc, x + 20, panelY + 128, 'italic 11.5px system-ui, sans-serif', COLORS.faint);
  } else if (state.shopSel) {
    const def = TOWERS[state.shopSel];
    text(ctx, def.name, x + 20, panelY + 22, '800 13.5px system-ui, sans-serif', COLORS.text);
    const stats = towerStats(state.shopSel, 1, state.mods);
    text(ctx, 'DMG ' + Math.round(stats.damage) + '   RNG ' + Math.round(stats.range) +
      '   RATE ' + stats.rate.toFixed(1) + '/s', x + 20, panelY + 42,
      '600 11.5px ui-monospace, monospace', COLORS.dim);
    text(ctx, def.desc, x + 20, panelY + 64, '12px system-ui, sans-serif', COLORS.dim);
    text(ctx, 'Click a grass tile to plant.', x + 20, panelY + 88, '12px system-ui, sans-serif', COLORS.dim);
    text(ctx, 'Right-click / Esc to cancel.', x + 20, panelY + 108, '12px system-ui, sans-serif', COLORS.faint);
  } else {
    text(ctx, 'How to play', x + 20, panelY + 22, '800 13.5px system-ui, sans-serif', COLORS.text);
    const lines = [
      '1. Pick a flower card above.',
      '2. Click grass to plant it.',
      '3. Send the wave, earn pollen,',
      '    grow towers to level 3.',
      'Wasps fly — Mortars & Sunblooms',
      'cannot reach them!',
    ];
    lines.forEach((ln, i) => text(ctx, ln, x + 20, panelY + 44 + i * 17,
      '12px system-ui, sans-serif', COLORS.dim));
  }

  // Next wave button + preview.
  const bwY = panelY + 158;
  const btnRect = { x: x + 10, y: bwY, w: SIDE_W - 20, h: 46 };
  state.ui.waveBtn = btnRect;
  const running = state.waveActive;
  ctx.fillStyle = running ? 'rgba(0,0,0,0.3)' : '#b3541e';
  rr(ctx, btnRect.x, btnRect.y, btnRect.w, btnRect.h, 9); ctx.fill();
  if (!running) { ctx.strokeStyle = '#ffb340'; ctx.lineWidth = 1.6; ctx.stroke(); }
  text(ctx, running ? '🌊 Wave ' + state.wave + ' marching…' :
    state.mode !== 'endless' && state.wave >= TOTAL_WAVES ? '🌼 Final wave cleared' :
    (state.wave === 0 ? '▶  Send Wave 1' : '▶  Send Wave ' + (state.wave + 1)),
    btnRect.x + btnRect.w / 2, bwY + 29, '800 15px system-ui, sans-serif',
    running ? COLORS.faint : '#fff7ea', 'center');
  if (state.mode === 'endless' || state.wave < TOTAL_WAVES) {
    const nw = state.wave + 1;
    text(ctx, 'Next: ' + seasonForWave(nw).icon + ' ' +
      (state.mode === 'endless' ? endlessPreview(nw) : wavePreview(nw)),
      x + 14, bwY + 68, '11.5px system-ui, sans-serif', COLORS.dim);
  }
  // Blessings taken this run, as an icon row (with stack counts).
  text(ctx, 'BLESSINGS', x + 14, bwY + 94, '800 11px system-ui, sans-serif', COLORS.faint);
  if (state.blessings && state.blessings.length) {
    const counts = {};
    for (const id of state.blessings) counts[id] = (counts[id] || 0) + 1;
    const icons = Object.keys(counts).map((id) =>
      BLESSINGS[id].icon + (counts[id] > 1 ? '×' + counts[id] : ''));
    text(ctx, icons.join('  '), x + 14, bwY + 116,
      '15px system-ui, sans-serif', COLORS.text);
  } else {
    text(ctx, 'Clear a wave to earn one', x + 14, bwY + 116,
      '11.5px system-ui, sans-serif', COLORS.faint);
  }
  if (state.spinBuff) {
    text(ctx, '🐝 FRENZY +25%', x + SIDE_W - 14, bwY + 94,
      '800 11px system-ui, sans-serif', COLORS.good, 'right');
  }
  // Three doors at the sidebar's foot: guide, quest board, slot.
  const gbW = (SIDE_W - 44) / 3;
  const mkBtn = (key, dx, label, active) => {
    const rect = { x: x + 10 + dx, y: bwY + 124, w: gbW, h: 26 };
    state.ui[key] = rect;
    ctx.fillStyle = active ? '#3d6128' : COLORS.panelSoft;
    rr(ctx, rect.x, rect.y, rect.w, rect.h, 7); ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 1.2; ctx.stroke();
    text(ctx, label, rect.x + gbW / 2, bwY + 141,
      '700 10.5px system-ui, sans-serif', COLORS.text, 'center');
  };
  mkBtn('guideBtn', 0, '📖 GUIDE', state.showGuide);
  mkBtn('questBtn', gbW + 8, '⭐ ' + state.questsDone.length + '/6', state.showQuests);
  mkBtn('spinBtn', (gbW + 8) * 2, '🎰 SPIN ✿' + SPIN_COST, state.showSpin);
}

function drawLog(ctx, state) {
  ctx.fillStyle = COLORS.hudBg;
  rr(ctx, FIELD_X, LOG_Y, FIELD_W, 82, 10); ctx.fill();
  ctx.strokeStyle = COLORS.hudEdge; ctx.lineWidth = 1.2; ctx.stroke();
  text(ctx, '📜 ' + state.log, FIELD_X + 14, LOG_Y + 30, '13px system-ui, sans-serif', COLORS.dim);
  text(ctx, 'Keys: 1–6 pick flower · Space send wave · P pause · U grow · S sell · G guide · Q quests · L slots · Esc cancel',
    FIELD_X + 14, LOG_Y + 56, '11.5px system-ui, sans-serif', COLORS.faint);
  // Legend of bug kinds still to come / present.
  text(ctx, 'Armor shrugs off weak hits · Frost slows · Bees poison · Lightning chains',
    FIELD_X + 560, LOG_Y + 30, '11.5px system-ui, sans-serif', COLORS.faint);
}

/* --- Placement ghost + banner --- */

function drawGhost(ctx, state) {
  if (state.phase !== 'play') return;
  if (state.selected) {
    const stats = towerStats(state.selected.type, state.selected.level, state.mods);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath(); ctx.arc(state.selected.x, state.selected.y, stats.range, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }
  if (!state.shopSel || !state.hoverCell) return;
  const { c, r } = state.hoverCell;
  const { x, y } = cellCenter(c, r);
  const ok = state.pollen >= TOWERS[state.shopSel].cost &&
    !state.pathKeys.has(c + ',' + r) &&
    !(c === HEART_CELL.c && r === HEART_CELL.r) &&
    !state.towers.some((t) => t.c === c && t.r === r);
  const stats = towerStats(state.shopSel, 1, state.mods);
  ctx.fillStyle = ok ? 'rgba(255,255,255,0.10)' : 'rgba(255, 60, 60, 0.12)';
  ctx.beginPath(); ctx.arc(x, y, stats.range, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ok ? 'rgba(255,255,255,0.4)' : 'rgba(255,80,80,0.6)';
  ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
  ctx.globalAlpha = 0.75;
  drawTowerHead(ctx, state.shopSel, x, y - 10, -Math.PI / 2, 1, state.time, 0);
  ctx.globalAlpha = 1;
}

function drawBanner(ctx, state) {
  if (!state.banner) return;
  const { text: t, sub } = state.banner;
  const w = 430;
  const x = FIELD_X + FIELD_W / 2 - w / 2;
  const y = FIELD_Y + 16;
  ctx.fillStyle = 'rgba(24, 36, 20, 0.88)';
  rr(ctx, x, y, w, sub ? 62 : 44, 12); ctx.fill();
  ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1.6; ctx.stroke();
  text(ctx, t, x + w / 2, y + (sub ? 27 : 29), '800 19px system-ui, sans-serif', '#fff7ea', 'center');
  if (sub) text(ctx, sub, x + w / 2, y + 48, '600 13px system-ui, sans-serif', COLORS.pollen, 'center');
}

/* --- Blessing offer (between waves) --- */

function wrapText(ctx, str, maxW) {
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? line + ' ' + w : w;
    if (ctx.measureText(next).width > maxW && line) { lines.push(line); line = w; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawBlessings(ctx, state) {
  if (!state.offer || state.phase !== 'play' || state.waveActive) return;
  ctx.fillStyle = 'rgba(10, 18, 8, 0.25)';
  ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
  const w = 852;
  const h = 138;
  const x = FIELD_X + (FIELD_W - w) / 2;
  const y = FIELD_BOTTOM - h - 14;
  ctx.fillStyle = 'rgba(22, 34, 18, 0.94)';
  rr(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = COLORS.pollen; ctx.lineWidth = 1.8; ctx.stroke();
  // When the cleared wave ended a season, the same choice is framed
  // as the Harvest Festival: bunting over the panel, festival title.
  const festival = isSeasonEndWave(state.wave);
  if (festival) {
    const bunt = ['#ff8fb3', '#ffd94d', '#7ee787', '#c9a0ff'];
    for (let i = 0; i < 12; i++) {
      const bx = x + 18 + i * 68;
      ctx.fillStyle = bunt[i % 4];
      ctx.beginPath();
      ctx.moveTo(bx, y + 2); ctx.lineTo(bx + 26, y + 2); ctx.lineTo(bx + 13, y + 15);
      ctx.closePath(); ctx.fill();
    }
  }
  text(ctx, festival
      ? '🎪 HARVEST FESTIVAL — THE SEASON TURNS, CHOOSE A GIFT'
      : '🌟 THE GARDEN OFFERS A BLESSING — CHOOSE ONE',
    x + w / 2, y + 27, '800 15.5px system-ui, sans-serif', '#fff7ea', 'center');
  state.ui.blessingCards = [];
  const cw = (w - 48) / 3;
  state.offer.forEach((id, i) => {
    const b = BLESSINGS[id];
    const cx = x + 16 + i * (cw + 8);
    const cy = y + 40;
    const rect = { id, x: cx, y: cy, w: cw, h: 66 };
    state.ui.blessingCards.push(rect);
    const hover = state.mouse.x >= cx && state.mouse.x <= cx + cw &&
      state.mouse.y >= cy && state.mouse.y <= cy + 66;
    ctx.fillStyle = hover ? '#3d6128' : COLORS.panelSoft;
    rr(ctx, cx, cy, cw, 66, 10); ctx.fill();
    ctx.strokeStyle = hover ? COLORS.pollen : COLORS.panelEdge;
    ctx.lineWidth = hover ? 2.2 : 1.2; ctx.stroke();
    text(ctx, b.icon, cx + 30, cy + 42, '26px system-ui, sans-serif', COLORS.text, 'center');
    text(ctx, b.name, cx + 52, cy + 27, '800 13.5px system-ui, sans-serif', COLORS.text);
    ctx.font = '11.5px system-ui, sans-serif';
    const lines = wrapText(ctx, b.desc, cw - 64);
    lines.slice(0, 2).forEach((ln, li) =>
      text(ctx, ln, cx + 52, cy + 45 + li * 14, '11.5px system-ui, sans-serif', COLORS.dim));
  });
  text(ctx, 'Blessings stack for the whole run · or send the wave to let this one wilt',
    x + w / 2, y + h - 10, '11.5px system-ui, sans-serif', COLORS.faint, 'center');
}

/* --- Field guide (bestiary) --- */

function drawGuide(ctx, state) {
  if (!state.showGuide || state.phase !== 'play') return;
  ctx.fillStyle = 'rgba(10, 18, 8, 0.35)';
  ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
  const x = FIELD_X + 30;
  const y = FIELD_Y + 22;
  const w = FIELD_W - 60;
  const h = FIELD_H - 44;
  ctx.fillStyle = 'rgba(24, 36, 20, 0.97)';
  rr(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1.8; ctx.stroke();
  text(ctx, '📖 FIELD GUIDE', x + 24, y + 34,
    '900 19px system-ui, sans-serif', '#fff7ea');
  text(ctx, 'every bug & bloom, from the garden\u2019s own records — G or GUIDE closes it',
    x + 190, y + 34, '12px system-ui, sans-serif', COLORS.faint);

  // Left column: the blight bugs (rows derived in guide.js).
  const lx = x + 24;
  text(ctx, '🐛 THE BLIGHT BUGS', lx, y + 66, '800 13.5px system-ui, sans-serif', COLORS.accent);
  bugGuide().forEach((row, i) => {
    const ry = y + 84 + i * 56;
    ctx.fillStyle = row.color;
    ctx.beginPath(); ctx.arc(lx + 13, ry + 12, row.boss ? 13 : 10.5, 0, Math.PI * 2); ctx.fill();
    if (row.boss) {
      ctx.strokeStyle = '#ffb340'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(lx + 13, ry + 12, 15.5, 0, Math.PI * 2); ctx.stroke();
    }
    text(ctx, row.name, lx + 36, ry + 10, '800 13.5px system-ui, sans-serif', COLORS.text);
    text(ctx, '✿' + row.bounty, lx + 452, ry + 10,
      '700 12px ui-monospace, monospace', COLORS.pollen, 'right');
    ctx.font = '11.5px system-ui, sans-serif';
    const traits = wrapText(ctx, row.traits, 416);
    traits.slice(0, 2).forEach((ln, li) =>
      text(ctx, ln, lx + 36, ry + 27 + li * 14, '11.5px system-ui, sans-serif', COLORS.dim));
  });

  // Right column: the flower towers, mini heads and all.
  const rx = x + 516;
  text(ctx, '🌸 THE FLOWER TOWERS', rx, y + 66, '800 13.5px system-ui, sans-serif', COLORS.accent);
  towerGuide().forEach((row, i) => {
    const ry = y + 84 + i * 56;
    drawTowerHead(ctx, row.type, rx + 14, ry + 12, -Math.PI / 2, 0.8, state.time, 0);
    text(ctx, row.name, rx + 38, ry + 10, '800 13.5px system-ui, sans-serif', COLORS.text);
    text(ctx, '✿' + row.cost, rx + 424, ry + 10,
      '700 12px ui-monospace, monospace', COLORS.pollen, 'right');
    text(ctx, row.stats, rx + 38, ry + 27, '600 11px ui-monospace, monospace', COLORS.dim);
    text(ctx, row.line, rx + 38, ry + 43, 'italic 11.5px system-ui, sans-serif', COLORS.faint);
  });
  text(ctx, 'Towers grow as they level: sprout → young plant → full bloom. ' +
    'Frost slows, bees poison, lightning chains.',
    x + 24, y + h - 16, '11.5px system-ui, sans-serif', COLORS.faint);
}

/* --- Bloom Quests board --- */

function drawQuests(ctx, state) {
  if (!state.showQuests || state.phase !== 'play') return;
  ctx.fillStyle = 'rgba(10, 18, 8, 0.35)';
  ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
  const x = FIELD_X + 30;
  const y = FIELD_Y + 22;
  const w = FIELD_W - 60;
  const h = FIELD_H - 44;
  ctx.fillStyle = 'rgba(24, 36, 20, 0.97)';
  rr(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1.8; ctx.stroke();
  text(ctx, '⭐ BLOOM QUESTS', x + 24, y + 34,
    '900 19px system-ui, sans-serif', '#fff7ea');
  text(ctx, 'six garden trials — progress read live from the run · Q or QUEST closes it',
    x + 216, y + 34, '12px system-ui, sans-serif', COLORS.faint);
  text(ctx, state.questsDone.length + ' / ' + QUESTS.length + ' DONE',
    x + w - 24, y + 34, '800 14px system-ui, sans-serif', COLORS.pollen, 'right');
  QUESTS.forEach((q, i) => {
    const ry = y + 62 + i * 74;
    const done = state.questsDone.includes(q.id);
    const now = questNow(q, state);
    ctx.fillStyle = done ? 'rgba(255, 217, 77, 0.10)' : 'rgba(0,0,0,0.18)';
    rr(ctx, x + 24, ry, w - 48, 62, 9); ctx.fill();
    text(ctx, q.icon, x + 46, ry + 40, '24px system-ui, sans-serif', COLORS.text, 'center');
    text(ctx, q.name, x + 70, ry + 24, '800 14.5px system-ui, sans-serif',
      done ? COLORS.pollen : COLORS.text);
    text(ctx, q.goal, x + 70, ry + 43, '12px system-ui, sans-serif', COLORS.dim);
    const bw = 300;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, x + 70, ry + 50, bw, 6, 3); ctx.fill();
    if (now > 0) {
      ctx.fillStyle = done ? COLORS.pollen : COLORS.good;
      rr(ctx, x + 70, ry + 50, Math.max(6, bw * now / q.target), 6, 3); ctx.fill();
    }
    text(ctx, done ? '✓ DONE' : now + ' / ' + q.target, x + w - 48, ry + 30,
      '800 13px ui-monospace, monospace', done ? COLORS.pollen : COLORS.dim, 'right');
    text(ctx, '+' + q.reward + ' score', x + w - 48, ry + 48,
      '11.5px system-ui, sans-serif', COLORS.faint, 'right');
  });
  text(ctx, 'Quests pay in score & stars only — the garden\u2019s balance is never touched. ' +
    'Finish all six for the Golden Gardener crown.',
    x + 24, y + h - 14, '11.5px system-ui, sans-serif', COLORS.faint);
}

/* --- Lucky Sprout slot panel --- */

function drawSlotPanel(ctx, state) {
  if (!state.showSpin || state.phase !== 'play') return;
  ctx.fillStyle = 'rgba(10, 18, 8, 0.35)';
  ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
  const w = 640;
  const h = 292;
  const x = FIELD_X + (FIELD_W - w) / 2;
  const y = FIELD_Y + 106;
  ctx.fillStyle = 'rgba(24, 36, 20, 0.97)';
  rr(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1.8; ctx.stroke();
  text(ctx, '🎰 LUCKY SPROUT', x + w / 2, y + 32,
    '900 20px system-ui, sans-serif', '#fff7ea', 'center');
  const spinning = state.spin && !state.spin.paid;
  text(ctx, '✿' + SPIN_COST + ' a spin · ' + state.spinsLeft + ' of 3 spins left this break' +
    (state.spinBuff ? ' · 🐝 Frenzy armed for next wave' : ''),
    x + w / 2, y + 54, '12.5px system-ui, sans-serif', COLORS.dim, 'center');

  // The three reels.
  const display = reelDisplay(state.spin, state.time);
  const bw = 92;
  const rx = x + 30;
  display.forEach((reel, i) => {
    const bx = rx + i * (bw + 14);
    const by = y + 70;
    ctx.fillStyle = '#1c2b16';
    rr(ctx, bx, by, bw, bw, 10); ctx.fill();
    const landed = state.spin && state.spin.paid;
    ctx.strokeStyle = reel.spinning ? COLORS.panelEdge
      : landed ? COLORS.accent : '#55703f';
    ctx.lineWidth = reel.spinning ? 1.4 : 2.2; ctx.stroke();
    text(ctx, reel.icon, bx + bw / 2, by + 62, '52px system-ui, sans-serif', COLORS.text, 'center');
  });

  // The paytable, straight from luckyspin.js.
  const px = x + 368;
  text(ctx, 'PAYS', px, y + 84, '800 11.5px system-ui, sans-serif', COLORS.faint);
  PAYTABLE.forEach((row, i) => {
    text(ctx, row.icons, px, y + 103 + i * 16, '11.5px system-ui, sans-serif', COLORS.text);
    text(ctx, row.label, px + 52, y + 103 + i * 16, '10.5px system-ui, sans-serif', COLORS.dim);
  });
  text(ctx, 'any pair ✿25', px, y + 103 + PAYTABLE.length * 16,
    '10.5px system-ui, sans-serif', COLORS.dim);

  // Result line.
  const res = state.spin;
  const resText = spinning ? 'The reels are spinning…'
    : res ? res.text : 'Three garden reels. The Heartbloom almost never lands thrice — almost.';
  const resColor = res && res.paid
    ? (res.kind === 'jackpot' ? COLORS.pollen : res.kind === 'tax' ? COLORS.bad
      : res.kind === 'none' ? COLORS.dim : COLORS.good)
    : COLORS.dim;
  ctx.font = '700 13px system-ui, sans-serif';
  const resLines = wrapText(ctx, resText, w - 60);
  resLines.slice(0, 2).forEach((ln, li) =>
    text(ctx, ln, x + w / 2, y + h - 58 + li * 16,
      '700 13px system-ui, sans-serif', resColor, 'center'));

  // Buttons.
  const canSpin = !state.waveActive && !state.offer && state.spinsLeft > 0 &&
    state.pollen >= SPIN_COST && !spinning;
  const spinBtn = { x: x + w / 2 - 158, y: y + h - 46, w: 190, h: 36 };
  const closeBtn = { x: x + w / 2 + 44, y: y + h - 46, w: 114, h: 36 };
  state.ui.slotSpinBtn = spinBtn;
  state.ui.slotCloseBtn = closeBtn;
  ctx.fillStyle = canSpin ? '#b3541e' : 'rgba(0,0,0,0.3)';
  rr(ctx, spinBtn.x, spinBtn.y, spinBtn.w, spinBtn.h, 9); ctx.fill();
  if (canSpin) { ctx.strokeStyle = '#ffb340'; ctx.lineWidth = 1.6; ctx.stroke(); }
  text(ctx, spinning ? '··· SPINNING' : '🎰 SPIN — ✿' + SPIN_COST,
    spinBtn.x + spinBtn.w / 2, spinBtn.y + 23, '800 14px system-ui, sans-serif',
    canSpin ? '#fff7ea' : COLORS.faint, 'center');
  ctx.fillStyle = COLORS.panelSoft;
  rr(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 9); ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge; ctx.stroke();
  text(ctx, 'Close', closeBtn.x + closeBtn.w / 2, closeBtn.y + 23,
    '700 13px system-ui, sans-serif', COLORS.dim, 'center');
}

/* --- Screens --- */

function drawTitle(ctx, state) {
  // Gradient veil over the posed garden, deeper at the bottom.
  const veil = ctx.createLinearGradient(0, FIELD_Y, 0, FIELD_Y + FIELD_H);
  veil.addColorStop(0, 'rgba(14, 24, 11, 0.42)');
  veil.addColorStop(0.55, 'rgba(14, 24, 11, 0.56)');
  veil.addColorStop(1, 'rgba(10, 18, 8, 0.72)');
  ctx.fillStyle = veil;
  ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
  const cx = FIELD_X + FIELD_W / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 5;
  text(ctx, 'BLOOMHOLD', cx, FIELD_Y + 128, '900 84px system-ui, sans-serif', '#3d6128', 'center');
  ctx.shadowColor = 'rgba(255, 179, 64, 0.45)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 0;
  text(ctx, 'BLOOMHOLD', cx, FIELD_Y + 128, '900 84px system-ui, sans-serif', '#fff7ea', 'center');
  ctx.restore();
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 240, FIELD_Y + 146); ctx.lineTo(cx + 240, FIELD_Y + 146); ctx.stroke();
  // A garland of little blooms along the rule.
  for (let i = 0; i < 9; i++) {
    const gx = cx - 240 + i * 60;
    ctx.fillStyle = ['#ff8fb3', '#ffd94d', '#c9a0ff'][i % 3];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(gx + Math.cos(a) * 3.6, FIELD_Y + 146 + Math.sin(a) * 3.6, 2.7, 1.8, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffb340';
    ctx.beginPath(); ctx.arc(gx, FIELD_Y + 146, 2, 0, Math.PI * 2); ctx.fill();
  }
  text(ctx, 'A garden tower-defense. The blight bugs are coming for the Heartbloom —',
    cx, FIELD_Y + 182, '16px system-ui, sans-serif', COLORS.text, 'center');
  text(ctx, 'plant a living wall of flowers and hold all 24 waves.',
    cx, FIELD_Y + 204, '16px system-ui, sans-serif', COLORS.text, 'center');
  const feats = [
    '🌸  6 flower towers that grow: sprout → young plant → full bloom',
    '🐛  8 bug kinds — armored beetles, flying wasps, splitting mites',
    '👑  2 bosses: the Blight Brute & the Rot Pumpkin',
    '🎪  Blessings after every wave — a Harvest Festival each season',
    '⭐  Bloom Quests: 6 garden trials, ranked missions S/A/B/C',
    '🍂  4 seasons across the year: spring blossom to winter snow',
    '🎰  Lucky Sprout slots: spin pollen for jackpots & blessings',
    '♾  Everbloom: an endless score chase beyond wave 24',
    '✿  Pollen economy: bounties, wave interest & Sunbloom income',
  ];
  feats.forEach((f, i) => text(ctx, f, cx, FIELD_Y + 216 + i * 21,
    '600 14.5px system-ui, sans-serif', COLORS.dim, 'center'));
  const btn = { x: cx - 130, y: FIELD_Y + 402, w: 260, h: 58 };
  state.ui.startBtn = btn;
  ctx.fillStyle = '#b3541e';
  rr(ctx, btn.x, btn.y, btn.w, btn.h, 12); ctx.fill();
  ctx.strokeStyle = '#ffb340'; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, '▶  START PLANTING', cx, btn.y + 38, '800 19px system-ui, sans-serif', '#fff7ea', 'center');
  text(ctx, 'Mouse: plant, select, grow & sell · Space sends the next wave',
    cx, FIELD_Y + 484, '13px system-ui, sans-serif', COLORS.faint, 'center');
}

function drawEndScreen(ctx, state, won) {
  ctx.fillStyle = 'rgba(14, 22, 11, 0.78)';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  const s = state.overStats || { waves: state.wave, kills: state.kills, leaks: state.leaks, earned: state.earned, lives: state.lives, score: state.score, towers: state.towers.length };
  text(ctx, won ? '🌼 THE GARDEN HOLDS! 🌼' : '🥀 THE BLIGHT TOOK THE BLOOM', cx, 190,
    '900 44px system-ui, sans-serif', won ? '#ffe27a' : '#ff9d9d', 'center');
  text(ctx, won ? 'All 24 waves repelled. The Heartbloom blooms on.' :
    s.mode === 'endless'
      ? 'Everbloom swallowed the garden at wave ' + s.waves + '. What a run!'
      : 'The bugs reached the Heartbloom on wave ' + s.waves + '.',
    cx, 228, '16px system-ui, sans-serif', COLORS.text, 'center');
  const rows = [
    ['Final score', String(s.score)],
    ['Waves cleared', s.mode === 'endless' ? s.waves + ' (Everbloom)' : s.waves + ' / ' + TOTAL_WAVES],
    ['Bugs popped', String(s.kills)],
    ['Bugs that got through', String(s.leaks)],
    ['Pollen earned', String(s.earned)],
    ['Lives remaining', String(Math.max(0, s.lives))],
    ['Towers standing', String(s.towers)],
  ];
  if (state.blessings && state.blessings.length) {
    rows.push(['Blessings taken',
      state.blessings.map((id) => BLESSINGS[id].icon).join(' ')]);
  }
  if (s.spins) {
    rows.push(['Lucky Sprout spins', String(s.spins)]);
  }
  if (s.quests) {
    rows.push(['Bloom Quests', s.quests + ' / 6 ⭐']);
  }
  if (s.ranks) {
    const rk = ['S', 'A', 'B', 'C'].filter((r) => s.ranks[r])
      .map((r) => r + '×' + s.ranks[r]).join(' · ');
    if (rk) rows.push(['Mission ranks', rk]);
  }
  if (s.blocks) {
    rows.push(['Seed blocks popped', String(s.blocks)]);
  }
  const pw = 420;
  ctx.fillStyle = 'rgba(38, 58, 32, 0.92)';
  rr(ctx, cx - pw / 2, 262, pw, rows.length * 30 + 24, 12); ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge; ctx.stroke();
  rows.forEach(([k, v], i) => {
    const y = 262 + 36 + i * 30;
    text(ctx, k, cx - pw / 2 + 24, y, '13.5px system-ui, sans-serif', COLORS.dim);
    text(ctx, v, cx + pw / 2 - 24, y, '700 14.5px ui-monospace, monospace', COLORS.text, 'right');
  });
  const btnY = 262 + rows.length * 30 + 48;
  if (won && s.mode !== 'endless') {
    // The Everbloom offer: keep this very garden and chase the score.
    const eb = { x: cx - 252, y: btnY, w: 252, h: 54 };
    const rb = { x: cx + 12, y: btnY, w: 240, h: 54 };
    state.ui.endlessBtn = eb;
    state.ui.restartBtn = rb;
    ctx.fillStyle = '#5b3a8c';
    rr(ctx, eb.x, eb.y, eb.w, eb.h, 12); ctx.fill();
    ctx.strokeStyle = '#c9a0ff'; ctx.lineWidth = 2; ctx.stroke();
    text(ctx, '♾  EVERBLOOM — ENDLESS', cx - 126, btnY + 36,
      '800 16.5px system-ui, sans-serif', '#fff7ea', 'center');
    ctx.fillStyle = '#b3541e';
    rr(ctx, rb.x, rb.y, rb.w, rb.h, 12); ctx.fill();
    ctx.strokeStyle = '#ffb340'; ctx.lineWidth = 2; ctx.stroke();
    text(ctx, '↻  PLAY AGAIN', cx + 132, btnY + 36,
      '800 18px system-ui, sans-serif', '#fff7ea', 'center');
    text(ctx, 'Everbloom keeps your garden, towers & blessings — the blight just keeps coming.',
      cx, btnY + 78, '12.5px system-ui, sans-serif', COLORS.faint, 'center');
    return;
  }
  const btn = { x: cx - 120, y: btnY, w: 240, h: 54 };
  state.ui.restartBtn = btn;
  ctx.fillStyle = '#b3541e';
  rr(ctx, btn.x, btn.y, btn.w, btn.h, 12); ctx.fill();
  ctx.strokeStyle = '#ffb340'; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, '↻  PLAY AGAIN', cx, btn.y + 36, '800 18px system-ui, sans-serif', '#fff7ea', 'center');
}

/* --- Main render --- */

export function render(ctx, state) {
  ctx.fillStyle = '#141c11';
  ctx.fillRect(0, 0, W, H);
  if (state.shake > 0) {
    // Barrel-blast shake: the whole garden judders for a beat.
    const m = state.shake * 22;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  state.ui = {};
  drawField(ctx, state);
  drawHeartbloom(ctx, state);
  drawBlocks(ctx, state);
  drawGhost(ctx, state);
  // Towers under enemies; enemies sorted by y for a hint of depth.
  for (const t of state.towers) drawTower(ctx, state, t);
  const sorted = [...state.enemies].sort((a, b) => a.y - b.y);
  for (const e of sorted) drawEnemy(ctx, state, e);
  drawProjectiles(ctx, state);
  drawSeasonChip(ctx, state);
  drawHud(ctx, state);
  drawSidebar(ctx, state);
  drawLog(ctx, state);
  if (state.phase === 'play') drawBanner(ctx, state);
  if (state.phase === 'play') drawBlessings(ctx, state);
  drawSlotPanel(ctx, state);
  drawGuide(ctx, state);
  drawQuests(ctx, state);
  if (state.phase === 'title') drawTitle(ctx, state);
  if (state.phase === 'won') drawEndScreen(ctx, state, true);
  if (state.phase === 'lost') drawEndScreen(ctx, state, false);
  if (state.paused && state.phase === 'play') {
    ctx.fillStyle = 'rgba(10, 16, 8, 0.45)';
    ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    text(ctx, '❚❚ PAUSED', FIELD_X + FIELD_W / 2, FIELD_Y + FIELD_H / 2,
      '900 44px system-ui, sans-serif', '#fff7ea', 'center');
  }
}

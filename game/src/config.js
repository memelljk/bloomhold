// Bloomhold — shared constants: canvas, field geometry, the garden path,
// palette. Everything else imports from here so layout numbers live once.

export const W = 1280;
export const H = 800;

/** Fixed simulation step (seconds). The world only ever advances by this. */
export const STEP = 1 / 60;

export const HUD_H = 54;

/** Play field: a 16 x 10 grid of 64 px cells under the HUD bar. */
export const FIELD_X = 8;
export const FIELD_Y = 62;
export const CELL = 64;
export const COLS = 16;
export const ROWS = 10;
export const FIELD_W = COLS * CELL; // 1024
export const FIELD_H = ROWS * CELL; // 640
export const FIELD_BOTTOM = FIELD_Y + FIELD_H; // 702

/** Right sidebar (shop + selection panel). */
export const SIDE_X = FIELD_X + FIELD_W + 16; // 1048
export const SIDE_W = W - SIDE_X - 8; // 224

/** Bottom strip: message log + hints. */
export const LOG_Y = FIELD_BOTTOM + 8; // 710

/**
 * The dirt path, in cell coordinates (col, row), centre to centre.
 * Bugs enter off-screen left, wind through the garden, and reach the
 * Heartbloom at the final point.
 */
export const PATH_CELLS = [
  [-1, 1], [12, 1], [12, 3], [3, 3], [3, 6], [13, 6], [13, 8], [15, 8],
];

/** The Heartbloom the player defends sits on this cell. */
export const HEART_CELL = { c: 15, r: 8 };

export function cellCenter(c, r) {
  return { x: FIELD_X + c * CELL + CELL / 2, y: FIELD_Y + r * CELL + CELL / 2 };
}

export function cellAt(px, py) {
  const c = Math.floor((px - FIELD_X) / CELL);
  const r = Math.floor((py - FIELD_Y) / CELL);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
  return { c, r };
}

/** Set of "c,r" keys the path occupies (towers cannot be planted there). */
export function pathCellKeys() {
  const keys = new Set();
  for (let i = 0; i < PATH_CELLS.length - 1; i++) {
    let [c0, r0] = PATH_CELLS[i];
    const [c1, r1] = PATH_CELLS[i + 1];
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    let c = c0;
    let r = r0;
    for (let guard = 0; guard < 64; guard++) {
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) keys.add(c + ',' + r);
      if (c === c1 && r === r1) break;
      c += dc;
      r += dr;
    }
  }
  return keys;
}

export const COLORS = {
  grassA: '#5da24b',
  grassB: '#549544',
  grassDark: '#478237',
  path: '#c8a06d',
  pathEdge: '#a87f4f',
  pathStone: '#b28a58',
  soil: '#8a6844',
  hudBg: '#20301c',
  hudEdge: '#31482a',
  panel: '#263a20',
  panelEdge: '#3d5c31',
  panelSoft: '#2f4a27',
  text: '#f3f7e8',
  dim: '#b9cba6',
  faint: '#7e9370',
  pollen: '#ffd94d',
  heart: '#ff5d73',
  accent: '#ffb340',
  good: '#7ee787',
  bad: '#ff7b72',
  frost: '#9be7ff',
  bolt: '#ffe95e',
  poison: '#b6f09b',
};

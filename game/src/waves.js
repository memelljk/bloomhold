// The 24 waves of Bloomhold. Each wave is a list of groups; a group is
// { type, count, gap } — count bugs of that kind, one every gap seconds,
// groups start one after another with a short breather between them.
// New bug kinds are introduced one at a time so the player learns them:
// mites (2), shell beetles (4), wasps (5), gloom snails (7), splitters
// (9), the Blight Brute boss (12) and the Rot Pumpkin finale (24).
// Wave compositions grow in count and mix; hit points scale separately
// (see waveHpMul in enemies.js).

function g(type, count, gap) {
  return { type, count, gap };
}

export const WAVES = [
  /*  1 */ [g('aphid', 8, 1.1)],
  /*  2 */ [g('aphid', 8, 0.9), g('mite', 5, 0.5)],
  /*  3 */ [g('aphid', 12, 0.8), g('mite', 6, 0.45)],
  /*  4 */ [g('beetle', 4, 1.4), g('aphid', 8, 0.7)],
  /*  5 */ [g('wasp', 5, 1.0), g('aphid', 8, 0.7)],
  /*  6 */ [g('mite', 14, 0.35), g('beetle', 4, 1.2)],
  /*  7 */ [g('snail', 2, 3.0), g('aphid', 10, 0.6)],
  /*  8 */ [g('beetle', 7, 1.0), g('wasp', 6, 0.8)],
  /*  9 */ [g('splitter', 6, 1.1), g('mite', 8, 0.4)],
  /* 10 */ [g('snail', 3, 2.6), g('wasp', 8, 0.7), g('aphid', 10, 0.5)],
  /* 11 */ [g('beetle', 9, 0.9), g('splitter', 6, 1.0)],
  /* 12 */ [g('aphid', 10, 0.5), g('brute', 1, 1.0), g('wasp', 6, 0.8)],
  /* 13 */ [g('mite', 20, 0.3), g('snail', 3, 2.4)],
  /* 14 */ [g('wasp', 12, 0.6), g('beetle', 6, 1.0)],
  /* 15 */ [g('splitter', 10, 0.8), g('snail', 4, 2.2)],
  /* 16 */ [g('beetle', 12, 0.8), g('mite', 12, 0.35)],
  /* 17 */ [g('snail', 5, 2.0), g('wasp', 10, 0.6), g('aphid', 14, 0.4)],
  /* 18 */ [g('splitter', 12, 0.7), g('beetle', 8, 0.9)],
  /* 19 */ [g('wasp', 16, 0.5), g('snail', 4, 2.2)],
  /* 20 */ [g('mite', 26, 0.25), g('beetle', 10, 0.8), g('splitter', 8, 0.8)],
  /* 21 */ [g('snail', 7, 1.8), g('wasp', 12, 0.55)],
  /* 22 */ [g('beetle', 14, 0.7), g('splitter', 10, 0.7), g('mite', 14, 0.3)],
  /* 23 */ [g('snail', 6, 1.9), g('wasp', 14, 0.5), g('beetle', 8, 0.8)],
  /* 24 */ [g('aphid', 12, 0.4), g('titan', 1, 1.0), g('wasp', 10, 0.6), g('splitter', 8, 0.7)],
];

export const TOTAL_WAVES = WAVES.length;

/** Flatten a wave into a spawn schedule: [{ type, at }] in seconds. */
export function waveSchedule(waveNumber) {
  const groups = WAVES[waveNumber - 1];
  const out = [];
  let t = 0.5;
  for (const grp of groups) {
    for (let i = 0; i < grp.count; i++) {
      out.push({ type: grp.type, at: t });
      t += grp.gap;
    }
    t += 2.2; // breather between groups
  }
  return out;
}

/** One-line preview of the next wave for the sidebar, e.g. "8× Aphid · 5× Mite". */
export function wavePreview(waveNumber) {
  const groups = WAVES[waveNumber - 1];
  if (!groups) return '—';
  const names = {
    aphid: 'Aphid', mite: 'Mite', beetle: 'Beetle', snail: 'Snail',
    wasp: 'Wasp', splitter: 'Splitter', brute: 'BRUTE', titan: 'ROT PUMPKIN',
  };
  return groups.map((grp) => grp.count + '× ' + names[grp.type]).join(' · ');
}

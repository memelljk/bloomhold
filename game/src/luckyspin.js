// Lucky Sprout — the garden slot machine. Between waves the player
// spends pollen on a three-reel spin of garden symbols (Heartbloom,
// Sunbloom, honey, bees, petals, sprouts — and the blight skull).
// Prizes are bounded: pollen jackpots, a Blessing, two lives, a
// one-wave fire-rate frenzy, a small tax on three skulls. Expected
// return is well under the price — a pollen sink with spikes of joy.
// All rolls use state.luckRng, a dedicated stream, so the campaign
// replay (and the autoplayer, which never spins) is untouched.

import { BLESSINGS, BLESSING_ORDER } from './blessings.js';

export const SPIN_COST = 30;
export const SPINS_PER_BREAK = 3;
export const JACKPOT_POLLEN = 400;
export const PAIR_POLLEN = 25;
export const SKULL_TAX = 20;
export const FRENZY_RATE = 1.25; // Bee Frenzy: +25% fire rate, one wave

/** The reel strip: one weighted table (sums to 100) for all three
 * reels. Jackpot odds 0,0064%, three skulls 1,06%, a paying pair
 * ~31% — pollen EV ≈ +8,5 on a ✿30 spin (a sink overall). */
export const SLOT_SYMBOLS = [
  { id: 'skull', icon: '💀', name: 'Blight Skull', weight: 22 },
  { id: 'sprout', icon: '🌱', name: 'Sprout', weight: 22 },
  { id: 'petal', icon: '🌸', name: 'Petal', weight: 18 },
  { id: 'bee', icon: '🐝', name: 'Bee', weight: 15 },
  { id: 'honey', icon: '🍯', name: 'Honey Pot', weight: 12 },
  { id: 'sun', icon: '🌻', name: 'Sunbloom', weight: 7 },
  { id: 'heart', icon: '🌼', name: 'Heartbloom', weight: 4 },
];

const TOTAL_WEIGHT = SLOT_SYMBOLS.reduce((s, x) => s + x.weight, 0);

/** The paytable, richest first. `kind` selects the prize applier in
 * settleSpin; the renderer's panel prints these same rows. */
export const PAYTABLE = [
  { sym: 'heart', icons: '🌼🌼🌼', label: 'JACKPOT — ✿400 + a Blessing', kind: 'jackpot' },
  { sym: 'sun', icons: '🌻🌻🌻', label: '✿250 pollen', kind: 'pollen', amount: 250 },
  { sym: 'honey', icons: '🍯🍯🍯', label: '✿150 pollen', kind: 'pollen', amount: 150 },
  { sym: 'bee', icons: '🐝🐝🐝', label: 'Bee Frenzy — +25% fire rate, 1 wave', kind: 'frenzy' },
  { sym: 'petal', icons: '🌸🌸🌸', label: '+2 lives', kind: 'lives', amount: 2 },
  { sym: 'sprout', icons: '🌱🌱🌱', label: '✿60 pollen', kind: 'pollen', amount: 60 },
  { sym: 'skull', icons: '💀💀💀', label: 'Blight tax — −✿20', kind: 'tax' },
];

function pickSymbol(rng) {
  let roll = rng() * TOTAL_WEIGHT;
  for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
    roll -= SLOT_SYMBOLS[i].weight;
    if (roll < 0) return i;
  }
  return SLOT_SYMBOLS.length - 1;
}

/** Reel i stops this long after the spin starts (staggered landings). */
export function reelStopAt(spin, i) {
  return spin.startedAt + 0.7 + i * 0.45;
}

/** What each reel shows at a moment in time: cycling while it spins,
 * its rolled symbol once it lands. Pure function of the spin record —
 * the renderer never touches the outcome. */
export function reelDisplay(spin, time) {
  if (!spin) {
    // The panel's resting face before the first spin.
    return [2, 3, 6].map((idx) => ({ icon: SLOT_SYMBOLS[idx].icon, spinning: false }));
  }
  return spin.targets.map((target, i) => {
    if (time >= reelStopAt(spin, i)) {
      return { icon: SLOT_SYMBOLS[target].icon, spinning: false };
    }
    const cycle = Math.floor(time * 13 + i * 5) % SLOT_SYMBOLS.length;
    return { icon: SLOT_SYMBOLS[cycle].icon, spinning: true };
  });
}

/** Start a spin — all guards live here (phase, between waves, no
 * offer open, spins left, pollen, none rolling). Deducts the price
 * and rolls the three targets on the luck stream. */
export function startSpin(state) {
  if (state.phase !== 'play' || state.waveActive) return false;
  if (state.offer) return false; // pick (or wilt) the blessing first
  if (state.spin && !state.spin.paid) return false;
  if (state.spinsLeft <= 0 || state.pollen < SPIN_COST) return false;
  state.pollen -= SPIN_COST;
  state.spinsLeft -= 1;
  state.spinsTaken += 1;
  const targets = [pickSymbol(state.luckRng), pickSymbol(state.luckRng),
    pickSymbol(state.luckRng)];
  state.spin = {
    targets,
    startedAt: state.time,
    resolveAt: reelStopAt({ startedAt: state.time }, 2) + 0.15,
    paid: false,
    text: '',
    kind: '',
  };
  return true;
}

/** Apply the paytable once the last reel lands: a result record
 * { text, kind, pollen } for the world's side effects, or null.
 * Idempotent — a paid spin never pays twice. */
export function settleSpin(state) {
  const spin = state.spin;
  if (!spin || spin.paid || state.time < spin.resolveAt) return null;
  spin.paid = true;
  const ids = spin.targets.map((i) => SLOT_SYMBOLS[i].id);
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] || 0) + 1;
  let text = 'No luck this time — the garden keeps its pollen.';
  let kind = 'none';
  let pollen = 0;

  const triple = PAYTABLE.find((row) => counts[row.sym] === 3);
  if (triple) {
    kind = triple.kind;
    if (triple.kind === 'jackpot') {
      pollen = JACKPOT_POLLEN;
      const id = BLESSING_ORDER[Math.floor(state.luckRng() * BLESSING_ORDER.length)];
      BLESSINGS[id].apply(state);
      state.blessings.push(id);
      text = '🌼🌼🌼 JACKPOT! +' + JACKPOT_POLLEN + ' pollen and the ' +
        BLESSINGS[id].icon + ' ' + BLESSINGS[id].name + ' blessing!';
    } else if (triple.kind === 'pollen') {
      pollen = triple.amount;
      text = triple.icons + ' — +' + pollen + ' pollen!';
    } else if (triple.kind === 'frenzy') {
      state.spinBuff = { rate: FRENZY_RATE, wavesLeft: 1 };
      text = '🐝🐝🐝 BEE FRENZY! Towers fire +25% faster next wave!';
    } else if (triple.kind === 'lives') {
      state.lives = Math.min(20, state.lives + triple.amount);
      text = '🌸🌸🌸 The Heartbloom recovers +' + triple.amount + ' lives!';
    } else if (triple.kind === 'tax') {
      pollen = -Math.min(SKULL_TAX, state.pollen);
      text = '💀💀💀 The blight nibbles ' + (-pollen) + ' pollen away…';
    }
  } else {
    const pair = Object.keys(counts).find((id) => counts[id] === 2 && id !== 'skull');
    if (pair) {
      kind = 'pair';
      pollen = PAIR_POLLEN;
      text = 'A pair blooms — +' + PAIR_POLLEN + ' pollen.';
    }
  }

  if (pollen > 0) {
    state.pollen += pollen;
    state.earned += pollen;
    state.score += pollen;
  } else if (pollen < 0) {
    state.pollen += pollen; // already floored against the balance
  }
  spin.text = text;
  spin.kind = kind;
  return { text, kind, pollen };
}

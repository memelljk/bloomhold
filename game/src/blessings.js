// Garden Blessings — the between-wave meta layer: after a cleared
// wave the garden offers three gifts, the player picks one, gifts
// stack for the run; sending the next wave unpicked lets the offer
// wilt. A blessing is data plus its effect on state.mods (or, for
// Second Spring, on lives). Offers roll on a dedicated RNG, so the
// simulation stream — and every replay — is untouched.

export const BLESSINGS = {
  sunpetals: {
    icon: '🌞', name: 'Sun-Kissed Petals',
    desc: 'All towers deal +12% damage.',
    apply(state) { state.mods.damage *= 1.12; },
  },
  longroots: {
    icon: '🎯', name: 'Long Roots',
    desc: 'All towers reach +10% further.',
    apply(state) { state.mods.range *= 1.10; },
  },
  swiftsap: {
    icon: '💨', name: 'Swift Sap',
    desc: 'All towers fire +10% faster.',
    apply(state) { state.mods.rate *= 1.10; },
  },
  golden: {
    icon: '🍯', name: 'Golden Pollen',
    desc: 'Bugs drop +25% pollen bounty.',
    apply(state) { state.mods.bounty *= 1.25; },
  },
  deepbank: {
    icon: '🏦', name: 'Deep-Root Bank',
    desc: 'Wave interest cap rises to 90.',
    apply(state) { state.mods.interestCap = 90; },
  },
  choir: {
    icon: '🌻', name: 'Sun Choir',
    desc: 'Sunblooms grow +2 pollen per cycle.',
    apply(state) { state.mods.sunBonus += 2; },
  },
  winter: {
    icon: '❄️', name: "Winter's Edge",
    desc: 'Frostbloom slows bite deeper.',
    apply(state) { state.mods.frost += 1; },
  },
  spring: {
    icon: '💗', name: 'Second Spring',
    desc: 'The Heartbloom recovers +3 lives.',
    apply(state) { state.lives = Math.min(20, state.lives + 3); },
  },
};

export const BLESSING_ORDER = Object.keys(BLESSINGS);

/** The neutral modifier block every run starts with. */
export function freshMods() {
  return {
    damage: 1, range: 1, rate: 1, bounty: 1,
    interestCap: 50, sunBonus: 0, frost: 0,
  };
}

/** Roll three distinct blessing ids for the between-wave offer. */
export function rollOffer(rng) {
  const pool = [...BLESSING_ORDER];
  const offer = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(rng() * pool.length);
    offer.push(pool.splice(idx, 1)[0]);
  }
  return offer;
}

/** Take one blessing from the current offer. Returns false if the id
 * is not on offer (stale click, already taken, offer wilted). */
export function takeBlessing(state, id) {
  if (!state.offer || !state.offer.includes(id)) return false;
  BLESSINGS[id].apply(state);
  state.blessings.push(id);
  state.offer = null;
  return true;
}

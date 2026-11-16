// Bloom Quests — six garden trials that give the run a goals layer:
// concrete targets with live progress, a completion banner the
// moment one lands, and a score reward. Every metric is read off
// the live world state (kills, pollen earned, towers at full bloom,
// leak-free waves, bosses felled, the year won), so the board can
// never drift from the game it measures. Rewards are SCORE ONLY:
// quests never grant pollen, lives or modifiers, so a completion
// mid-fight cannot bend the campaign's proven balance.

export const QUESTS = [
  { id: 'bane', icon: '🐛', name: 'Bug Bane', target: 150, reward: 300,
    goal: 'Pop 150 bugs', metric: (s) => s.kills },
  { id: 'harvest', icon: '🌾', name: 'First Harvest', target: 800, reward: 300,
    goal: 'Earn 800 pollen in bounties & interest', metric: (s) => s.earned },
  { id: 'bloom', icon: '🌻', name: 'Full Bloom', target: 4, reward: 400,
    goal: 'Stand 4 towers at full bloom (level 3)', metric: (s) =>
      s.towers.filter((t) => t.level >= 3).length },
  { id: 'flawless', icon: '🛡️', name: 'Flawless Hold', target: 3, reward: 500,
    goal: 'Clear 3 waves without a single leak', metric: (s) => s.flawless },
  { id: 'bossfall', icon: '👑', name: 'Bossfall', target: 1, reward: 600,
    goal: 'Fell a boss — Brute, Pumpkin or Titan', metric: (s) => s.bossKills },
  { id: 'year', icon: '🏆', name: 'Year Keeper', target: 1, reward: 1000,
    goal: 'Hold all 24 waves and win the year', metric: (s) =>
      (s.phase === 'won' || s.mode === 'endless' ||
        (s.wave >= 24 && !s.waveActive)) ? 1 : 0 },
];

/** Progress of one quest: current value, clamped for display. */
export function questNow(q, state) {
  return Math.min(q.target, Math.floor(q.metric(state)));
}

/** Mark every quest whose target the run has just reached: bank its
 * score reward, raise the banner, note it in the log. Called from
 * the world's kill / upgrade / wave-clear hooks; idempotent — a
 * quest pays out exactly once, when state.questsDone gains its id. */
export function checkQuests(state) {
  for (const q of QUESTS) {
    if (state.questsDone.includes(q.id)) continue;
    if (q.metric(state) < q.target) continue;
    state.questsDone.push(q.id);
    state.score += q.reward;
    state.bonusScore += q.reward; // score-only: see world.js bonusScore
    state.banner = {
      text: '⭐ QUEST COMPLETE — ' + q.name,
      sub: '+' + q.reward + ' score · ' + state.questsDone.length +
        ' of ' + QUESTS.length + ' trials done',
      until: state.time + 2.6,
    };
    state.log = '⭐ Quest complete: ' + q.name + ' (+' + q.reward + ' score). ' +
      state.questsDone.length + ' of ' + QUESTS.length + ' Bloom Quests done.';
  }
}

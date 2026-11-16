// The four seasons: the campaign is a year — waves 1–6 Spring,
// 7–12 Summer, 13–18 Autumn, 19–24 Winter, and Everbloom years turn
// the same cycle. Each season carries a field palette, light and
// weather (render.js reads them); a season's end frames the Blessing
// choice as the Harvest Festival. Pure data + functions of the wave
// number — the simulation never knows what season it is.

/** Season table, in year order: grass tones, the light tint washed
 * over the field, and the ambient weather render.js draws. */
export const SEASONS = [
  {
    id: 'spring', name: 'Spring', icon: '🌸',
    grassA: '#63aa4e', grassB: '#589a45', grassDark: '#4c8a3c',
    tint: 'rgba(255, 183, 213, 0.05)', weather: 'petals',
  },
  {
    id: 'summer', name: 'Summer', icon: '☀️',
    grassA: '#57a047', grassB: '#4c9040', grassDark: '#418034',
    tint: 'rgba(255, 244, 170, 0.05)', weather: 'none',
  },
  {
    id: 'autumn', name: 'Autumn', icon: '🍂',
    grassA: '#a3a04b', grassB: '#93913f', grassDark: '#7d7c33',
    tint: 'rgba(255, 150, 60, 0.07)', weather: 'leaves',
  },
  {
    id: 'winter', name: 'Winter', icon: '❄️',
    grassA: '#bccfc9', grassB: '#aabdba', grassDark: '#8fa8a8',
    tint: 'rgba(160, 190, 255, 0.08)', weather: 'snow',
  },
];

export const WAVES_PER_SEASON = 6;
export const SEASON_CYCLE = WAVES_PER_SEASON * SEASONS.length; // 24

/** Position inside the 24-wave year (1..24); endless years fold. */
export function yearWave(wave) {
  if (wave <= 0) return 1;
  return ((wave - 1) % SEASON_CYCLE) + 1;
}

/** The season a wave is fought in. The title garden (wave 0) is spring. */
export function seasonForWave(wave) {
  const idx = Math.floor((yearWave(wave) - 1) / WAVES_PER_SEASON);
  return SEASONS[Math.min(SEASONS.length - 1, idx)];
}

/** True when this wave opens a new season (7, 13, 19 — and 25, 31, …
 * in Everbloom years): the season-turn banner fires. */
export function isSeasonTurnWave(wave) {
  if (wave <= 1) return false;
  const yw = yearWave(wave);
  return yw === 1 || (yw - 1) % WAVES_PER_SEASON === 0;
}

/** True when clearing this wave ends a season (6, 12, 18, 24, …):
 * the Blessing that follows is a Harvest Festival gift. */
export function isSeasonEndWave(wave) {
  return wave > 0 && yearWave(wave) % WAVES_PER_SEASON === 0;
}

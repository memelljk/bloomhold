// Mouse + keyboard input. The renderer leaves button rectangles in
// state.ui every frame; this module hit-tests clicks against them and
// turns field clicks into plant / select actions in world.js.

import { cellAt, FIELD_X, FIELD_Y, FIELD_W, FIELD_H } from './config.js';
import { TOWER_ORDER, TOWERS, upgradeCost, sellValue } from './towers.js';
import {
  placeTower, doUpgrade, sellTower, startWave, log,
} from './world.js';
import { BLESSINGS, takeBlessing } from './blessings.js';
import { ensureAudio } from './audio.js';

function inRect(x, y, r) {
  return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function attachInput(canvas, hooks) {
  const toGame = (ev) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) * (canvas.width / rect.width),
      y: (ev.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  canvas.addEventListener('mousemove', (ev) => {
    const state = hooks.state();
    const { x, y } = toGame(ev);
    state.mouse = { x, y };
    state.hoverCell = cellAt(x, y);
  });

  canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const state = hooks.state();
    state.shopSel = null;
    state.selected = null;
  });

  canvas.addEventListener('click', (ev) => {
    const state = hooks.state();
    state.soundOn = true;
    ensureAudio();
    const { x, y } = toGame(ev);
    const ui = state.ui || {};

    if (state.phase === 'title') {
      if (inRect(x, y, ui.startBtn)) hooks.onStart();
      return;
    }
    if (state.phase === 'won' || state.phase === 'lost') {
      if (inRect(x, y, ui.restartBtn)) hooks.onRestart();
      return;
    }
    if (state.phase !== 'play') return;

    if (inRect(x, y, ui.speedBtn)) {
      state.speed = state.speed >= 3 ? 1 : state.speed + 1;
      return;
    }
    if (inRect(x, y, ui.pauseBtn)) { state.paused = !state.paused; return; }
    if (inRect(x, y, ui.muteBtn)) { state.muted = !state.muted; return; }
    if (inRect(x, y, ui.waveBtn)) { startWave(state); return; }

    if (ui.blessingCards) {
      for (const card of ui.blessingCards) {
        if (inRect(x, y, card)) {
          if (takeBlessing(state, card.id)) {
            const b = BLESSINGS[card.id];
            log(state, 'Blessing taken: ' + b.icon + ' ' + b.name + ' — ' + b.desc);
          }
          return;
        }
      }
    }

    if (ui.shop) {
      for (const key of TOWER_ORDER) {
        if (inRect(x, y, ui.shop[key])) {
          state.shopSel = state.shopSel === key ? null : key;
          state.selected = null;
          if (state.shopSel) {
            log(state, TOWERS[key].name + ' — click grass to plant (✿' +
              TOWERS[key].cost + ').');
          }
          return;
        }
      }
    }
    if (state.selected && inRect(x, y, ui.upgradeBtn)) {
      doUpgrade(state, state.selected, upgradeCost(state.selected));
      return;
    }
    if (state.selected && inRect(x, y, ui.sellBtn)) {
      sellTower(state, state.selected, sellValue(state.selected));
      return;
    }

    // Field clicks.
    if (x >= FIELD_X && x < FIELD_X + FIELD_W && y >= FIELD_Y && y < FIELD_Y + FIELD_H) {
      const cell = cellAt(x, y);
      if (!cell) return;
      if (state.shopSel) {
        const tower = placeTower(state, state.shopSel, cell.c, cell.r);
        if (tower) {
          state.selected = tower;
          if (state.pollen < TOWERS[state.shopSel].cost) state.shopSel = null;
          else state.selected = null; // keep planting more of the same
        }
        return;
      }
      const found = state.towers.find((t) => t.c === cell.c && t.r === cell.r);
      state.selected = found || null;
    }
  });

  window.addEventListener('keydown', (ev) => {
    const state = hooks.state();
    if (state.phase === 'title') {
      if (ev.key === ' ' || ev.key === 'Enter') { state.soundOn = true; ensureAudio(); hooks.onStart(); }
      return;
    }
    if (state.phase === 'won' || state.phase === 'lost') {
      if (ev.key === ' ' || ev.key === 'Enter') hooks.onRestart();
      return;
    }
    if (state.phase !== 'play') return;
    const digit = parseInt(ev.key, 10);
    if (digit >= 1 && digit <= 6) {
      state.shopSel = TOWER_ORDER[digit - 1];
      state.selected = null;
    } else if (ev.key === ' ') {
      ev.preventDefault();
      startWave(state);
    } else if (ev.key === 'p' || ev.key === 'P') {
      state.paused = !state.paused;
    } else if (ev.key === 'u' || ev.key === 'U') {
      if (state.selected) doUpgrade(state, state.selected, upgradeCost(state.selected));
    } else if (ev.key === 's' || ev.key === 'S') {
      if (state.selected) sellTower(state, state.selected, sellValue(state.selected));
    } else if (ev.key === 'Escape') {
      state.shopSel = null;
      state.selected = null;
    }
  });
}

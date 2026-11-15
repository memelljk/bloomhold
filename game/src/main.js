// Boot: wire canvas, input and the fixed-step loop. Two modes:
//  - play (default): a title world idles behind the menu; starting makes
//    a fresh garden. The world advances by fixed STEPs, sped up by the
//    speed toggle; rendering happens every animation frame.
//  - screenshot (?shot=title|battle|boss|win&seed=N): build one posed
//    scene from shots.js, render a single frame, and flag
//    window.__shotReady so the capture script knows it can shoot.

import { W, H, STEP } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { render } from './render.js';
import { attachInput } from './input.js';
import { buildScene, sceneTitle } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const params = new URLSearchParams(location.search);
const shot = params.get('shot');

function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}

if (shot) {
  const seed = parseInt(params.get('seed') || '7', 10) || 7;
  const state = buildScene(shot, seed);
  render(ctx, state);
  window.__shotReady = true;
} else {
  let state = sceneTitle(randomSeed());
  const hooks = {
    state: () => state,
    onStart() {
      state = createWorld(randomSeed());
      state.phase = 'play';
      state.soundOn = true;
    },
    onRestart() {
      state = createWorld(randomSeed());
      state.phase = 'play';
      state.soundOn = true;
    },
  };
  attachInput(canvas, hooks);

  let last = performance.now();
  let acc = 0;
  let statusTimer = 0;
  function frame(now) {
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > 0.25) elapsed = 0.25;
    if (state.phase === 'title') {
      state.time += elapsed; // ambient animation only; the garden is posed
    } else if (!state.paused) {
      acc += elapsed * state.speed;
      let guard = 0;
      while (acc >= STEP && guard < 240) {
        stepWorld(state);
        acc -= STEP;
        guard += 1;
      }
    }
    render(ctx, state);
    statusTimer += elapsed;
    if (statusTimer > 1 && status) {
      statusTimer = 0;
      status.textContent = 'Wave ' + Math.max(1, state.wave) + ' of 24. ' +
        state.lives + ' lives. ' + Math.floor(state.pollen) + ' pollen. Score ' + state.score + '.';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Procedural WebAudio sound: no audio files, every effect is a small
// oscillator/noise recipe. Created lazily on the first user gesture (and
// never in screenshot mode). A mute flag lives on the game state.

let ctx = null;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

function tone(freq, dur, type = 'sine', gain = 0.05, slideTo = null, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, gain = 0.04, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(ctx.destination);
  src.start(t0);
}

export const sfx = {
  shoot() { tone(620 + Math.random() * 120, 0.06, 'triangle', 0.015); },
  frost() { tone(880, 0.09, 'sine', 0.02, 420); },
  thud() { noiseBurst(0.08, 0.03); },
  zap() { tone(1400, 0.07, 'sawtooth', 0.018, 220); },
  pop() { tone(300, 0.08, 'square', 0.025, 90); noiseBurst(0.05, 0.02); },
  coin() { tone(1180, 0.07, 'sine', 0.03); tone(1560, 0.1, 'sine', 0.03, null, 0.06); },
  plant() { tone(240, 0.1, 'triangle', 0.04, 360); },
  upgrade() { tone(520, 0.08, 'triangle', 0.04); tone(780, 0.12, 'triangle', 0.04, null, 0.07); },
  leak() { tone(196, 0.25, 'sawtooth', 0.05, 98); },
  horn() { tone(392, 0.16, 'triangle', 0.05); tone(523, 0.22, 'triangle', 0.05, null, 0.12); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.05, null, i * 0.13)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.26, 'triangle', 0.05, null, i * 0.15)); },
};

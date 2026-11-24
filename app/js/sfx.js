// 连击音效：用 Web Audio 现场合成，不依赖外部音频文件

import { settings } from './store.js';

let ac = null;

function audio() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

function tone(freq, { at = 0, dur = 0.12, gain = 0.04, type = 'sine' } = {}) {
  const ctx = audio();
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

// C 大调五声音阶，连对越多音越高
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 987.77, 1046.5, 1174.66, 1318.51];

export function comboHit(combo) {
  if (!settings().comboFx) return;
  try {
    const idx = (Math.max(1, combo) - 1) % SCALE.length;
    tone(SCALE[idx], { dur: 0.09, gain: 0.032, type: 'triangle' });
    if (combo >= 5 && combo % 5 === 0) {
      const lift = combo >= 15 ? 1.25 : combo >= 10 ? 1.12 : 1;
      [0, 0.09, 0.18].forEach((at, i) => {
        tone(SCALE[(3 + i) % SCALE.length] * lift, { at, dur: 0.18, gain: 0.038, type: 'sine' });
      });
    }
  } catch {}
}

export function success() {
  if (!settings().sfx) return;
  try {
    tone(659.25, { dur: 0.1, gain: 0.028 });
    tone(880, { at: 0.07, dur: 0.14, gain: 0.028 });
  } catch {}
}

export function error() {
  if (!settings().sfx) return;
  try {
    tone(220, { dur: 0.18, gain: 0.035, type: 'sawtooth' });
    tone(164.81, { at: 0.06, dur: 0.2, gain: 0.026, type: 'sine' });
  } catch {}
}

import type { RideAlertKind } from "../data/hazardTypes";

// Synthesized alert sounds (Web Audio API) so a rider can tell what kind of
// hazard is nearby by ear, without looking at the phone - no audio files to
// ship or license, works fully offline.
let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

/** Call from the "start ride" click handler (a real user gesture) so playback isn't blocked by autoplay policies later. */
export function primeRideAudio(): void {
  getContext();
}

/** Police: a real two-tone siren wail (frequency sweeping up/down), loud and unmistakable. */
function policeSiren(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  const t0 = ctx.currentTime;
  const duration = 1.6;
  const cycleLen = 0.5; // one full up-down wail cycle

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.55, t0 + 0.04);

  osc.frequency.setValueAtTime(480, t0);
  for (let cycleStart = t0; cycleStart < t0 + duration; cycleStart += cycleLen) {
    osc.frequency.linearRampToValueAtTime(1150, cycleStart + cycleLen / 2);
    osc.frequency.linearRampToValueAtTime(480, cycleStart + cycleLen);
  }

  gain.gain.setValueAtTime(0.55, t0 + duration - 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Inspector: a harsh, fast-chopped high-pitched alarm - deliberately grating, like a smoke detector. */
function inspectorAlarm(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  const t0 = ctx.currentTime;
  const duration = 1.1;

  osc.type = "square";
  osc.frequency.setValueAtTime(1700, t0);
  osc.frequency.linearRampToValueAtTime(2000, t0 + duration);

  // fast on/off chopping via an LFO modulating the gain - this is what makes
  // it read as "screechy alarm" instead of a plain tone.
  lfo.type = "square";
  lfo.frequency.value = 22;
  lfoGain.gain.value = 0.28;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);

  gain.gain.setValueAtTime(0.5, t0);
  gain.gain.setValueAtTime(0.5, t0 + duration - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  lfo.start(t0);
  osc.stop(t0 + duration + 0.02);
  lfo.stop(t0 + duration + 0.02);
}

function otherHazardBeeps(ctx: AudioContext) {
  const t0 = ctx.currentTime;
  [0, 0.16, 0.32].forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440;
    const t = t0 + offset;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  });
}

export function playRideAlert(kind: RideAlertKind): void {
  const ctx = getContext();
  if (!ctx) return;
  if (kind === "police") policeSiren(ctx);
  else if (kind === "inspector") inspectorAlarm(ctx);
  else otherHazardBeeps(ctx);
}

/** Waze-style "recalculating route" chime: two short neutral blips, distinct from both the hazard alerts (which warn) and the prize chime (which rewards) - just a status cue. */
export function playRouteRecalculating(): void {
  const ctx = getContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [660, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = t0 + i * 0.11;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.17);
  });
}

/** Prize pickup chime: a bright ascending major arpeggio - the classic "coin get" feel, unmistakably a reward rather than a warning. */
export function playPrizeCollected(): void {
  const ctx = getContext();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const notes = [880, 1108.73, 1318.51, 1760]; // A5, C#6, E6, A6 - a bright major triad + octave
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const t = t0 + i * 0.07;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.37);
  });
}

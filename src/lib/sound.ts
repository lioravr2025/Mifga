import type { RideAlertKind } from "../data/hazardTypes";

// Synthesized beep alerts (Web Audio API) so a rider can tell what kind of
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

function beep(ctx: AudioContext, freq: number, startOffset: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Call from the "start ride" click handler (a real user gesture) so playback isn't blocked by autoplay policies later. */
export function primeRideAudio(): void {
  getContext();
}

export function playRideAlert(kind: RideAlertKind): void {
  const ctx = getContext();
  if (!ctx) return;
  if (kind === "police") {
    // urgent alternating two-tone, like a mini siren
    beep(ctx, 880, 0, 0.15);
    beep(ctx, 660, 0.18, 0.15);
    beep(ctx, 880, 0.36, 0.15);
  } else if (kind === "inspector") {
    // single steady medium beep
    beep(ctx, 660, 0, 0.32);
  } else {
    // three short low beeps
    beep(ctx, 440, 0, 0.12);
    beep(ctx, 440, 0.16, 0.12);
    beep(ctx, 440, 0.32, 0.12);
  }
}

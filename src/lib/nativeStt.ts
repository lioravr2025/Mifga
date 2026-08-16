import { Capacitor, registerPlugin } from "@capacitor/core";

interface SttListenerPlugin {
  startListening(options: { biasing?: string[] }): Promise<{ candidates: string[] }>;
  stopListening(): Promise<void>;
}

/** Native Android plugin (android.speech.SpeechRecognizer) for dictating an address - only registered/used on Android; other platforms just don't show the mic button (see AddressAutocomplete.tsx). */
const SttListener = registerPlugin<SttListenerPlugin>("SttListener");

export function isVoiceInputSupported(): boolean {
  return Capacitor.getPlatform() === "android";
}

// Should never be hit under normal use (SpeechRecognizer settles within a
// few seconds either way) - exists purely as a safety net against native
// recognizer quirks (an unmatched language tag, an OEM speech-service bug)
// where neither onResults nor onError ever fires and the caller's "מקשיב"
// popup would otherwise hang forever with no way to dismiss it short of
// force-closing the app.
const LISTEN_TIMEOUT_MS = 12_000;

/**
 * Resolves with the recognizer's ranked hypotheses for what was said (best
 * guess first), or throws if denied/unavailable/no speech detected/timed
 * out - caller shows its own error state.
 *
 * Returns multiple candidates, not just one: the on-device recognizer has
 * no real Israeli address vocabulary, so its top guess is often wrong on a
 * street name it doesn't know, while a lower-ranked guess frequently is the
 * real word. A caller with something to check candidates against (a real
 * address/city search) should try them in rank order and use the first one
 * that actually matches something, instead of trusting index 0 blindly.
 *
 * `biasing`: optional list of known-good phrases (e.g. real city names) to
 * bias the recognizer toward - only takes effect on Android 13+, silently
 * ignored on older devices.
 */
export async function listenForAddress(biasing?: string[]): Promise<string[]> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("STT_TIMEOUT")), LISTEN_TIMEOUT_MS);
  });
  try {
    const { candidates } = await Promise.race([SttListener.startListening({ biasing }), timeout]);
    if (!candidates || candidates.length === 0) throw new Error("STT_NO_RESULT");
    return candidates;
  } catch (err) {
    SttListener.stopListening().catch(() => {});
    throw err;
  }
}

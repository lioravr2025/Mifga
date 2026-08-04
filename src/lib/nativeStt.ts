import { Capacitor, registerPlugin } from "@capacitor/core";

interface SttListenerPlugin {
  startListening(): Promise<{ text: string }>;
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

/** Resolves with the recognized Hebrew text, or throws if denied/unavailable/no speech detected/timed out - caller shows its own error state. */
export async function listenForAddress(): Promise<string> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("STT_TIMEOUT")), LISTEN_TIMEOUT_MS);
  });
  try {
    const { text } = await Promise.race([SttListener.startListening(), timeout]);
    return text;
  } catch (err) {
    SttListener.stopListening().catch(() => {});
    throw err;
  }
}

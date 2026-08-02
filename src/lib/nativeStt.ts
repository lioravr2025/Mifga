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

/** Resolves with the recognized Hebrew text, or throws if denied/unavailable/no speech detected - caller shows its own error state. */
export async function listenForAddress(): Promise<string> {
  const { text } = await SttListener.startListening();
  return text;
}

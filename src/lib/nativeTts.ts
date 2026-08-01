import { registerPlugin } from "@capacitor/core";

export interface NativeTtsVoice {
  id: string;
  name: string;
  requiresNetwork?: boolean;
}

interface TtsSpeakerPlugin {
  getVoices(): Promise<{ voices: NativeTtsVoice[] }>;
  speak(options: { text: string; voiceId?: string }): Promise<void>;
  stop(): Promise<void>;
}

/** Native Android plugin (android.speech.tts.TextToSpeech) - see TtsSpeakerPlugin.java for why: the WebView doesn't implement window.speechSynthesis at all. Only registered/used on Android for now (see speech.ts); web and any future iOS build fall back to the Web Speech API. */
export const TtsSpeaker = registerPlugin<TtsSpeakerPlugin>("TtsSpeaker");

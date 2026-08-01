import { Capacitor } from "@capacitor/core";
import { TtsSpeaker } from "./nativeTts";

export interface VoiceOption {
  id: string;
  name: string;
}

// Android's System WebView doesn't implement window.speechSynthesis at all
// (confirmed via remote diagnostics from real devices - present in a normal
// Chrome browser on the same phone, absent in the WebView component apps
// embed), so Android routes through the native TtsSpeaker plugin instead
// (see TtsSpeakerPlugin.java). iOS's WKWebView has reasonable Web Speech API
// support, so a future iOS build can keep using the fallback branch below
// as-is; only add "ios" here once/if that turns out not to be true, or once
// a native iOS TtsSpeaker plugin is built to match.
const HAS_NATIVE_TTS = Capacitor.getPlatform() === "android";

function isHebrewWebVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = voice.lang.toLowerCase();
  // "iw" is the old ISO 639-1 code for Hebrew that some engines still report.
  return lang.startsWith("he") || lang.startsWith("iw");
}

export function isSpeechSupported(): boolean {
  return HAS_NATIVE_TTS || "speechSynthesis" in window;
}

/** Every Hebrew voice currently available for navigation announcements - native TextToSpeech voices on Android, Web Speech API voices elsewhere. Empty until voices have loaded (native: after TTS engine init; web: often after "voiceschanged" fires). */
export async function getHebrewVoices(): Promise<VoiceOption[]> {
  if (HAS_NATIVE_TTS) {
    try {
      const { voices } = await TtsSpeaker.getVoices();
      return voices;
    } catch {
      return [];
    }
  }
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter(isHebrewWebVoice)
    .map((v) => ({ id: v.voiceURI, name: v.name }));
}

/** `voiceId` picks a specific Hebrew voice (from getHebrewVoices()); omitted/not-found falls back to the engine's default Hebrew voice. If the device has none at all, playback is skipped rather than mispronouncing the text in another language. */
export async function speak(text: string, voiceId?: string | null): Promise<void> {
  if (HAS_NATIVE_TTS) {
    try {
      await TtsSpeaker.speak({ text, voiceId: voiceId ?? undefined });
    } catch (err) {
      console.error("Mifga: native speak failed", err);
    }
    return;
  }
  if (!("speechSynthesis" in window)) return;
  try {
    const hebrewVoices = window.speechSynthesis.getVoices().filter(isHebrewWebVoice);
    const chosen = (voiceId && hebrewVoices.find((v) => v.voiceURI === voiceId)) || hebrewVoices[0];
    if (!chosen) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = chosen;
    utterance.lang = chosen.lang;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // TTS unsupported/blocked on this device - navigation still works visually.
  }
}

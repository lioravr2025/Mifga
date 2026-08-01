/**
 * Hebrew turn-by-turn voice announcements via the Web Speech API - no audio
 * files, works fully offline once the device has a Hebrew TTS voice
 * installed. Setting only `utterance.lang` isn't enough on many engines:
 * they fall back to the system default voice (often English) and just
 * mispronounce the Hebrew text through it. Explicitly assigning a real
 * Hebrew `SpeechSynthesisVoice` to `utterance.voice` is what actually forces
 * Hebrew playback, so `speak()` always resolves one before speaking.
 */
function isHebrewVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = voice.lang.toLowerCase();
  // "iw" is the old ISO 639-1 code for Hebrew that some engines still report.
  return lang.startsWith("he") || lang.startsWith("iw");
}

/** Every Hebrew voice this device's speech engine currently exposes - empty until the engine has loaded its voice list. */
export function getHebrewVoices(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().filter(isHebrewVoice);
}

export function isSpeechSupported(): boolean {
  return "speechSynthesis" in window;
}

/** `voiceURI` picks a specific Hebrew voice (from getHebrewVoices()); omitted/not-found falls back to the first Hebrew voice available. If the device has none at all, playback is skipped rather than mispronouncing the text in another language. */
export function speak(text: string, voiceURI?: string | null): void {
  if (!("speechSynthesis" in window)) return;
  try {
    const hebrewVoices = getHebrewVoices();
    const chosen = (voiceURI && hebrewVoices.find((v) => v.voiceURI === voiceURI)) || hebrewVoices[0];
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

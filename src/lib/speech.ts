/**
 * Hebrew turn-by-turn voice announcements via the Web Speech API - no audio
 * files, works fully offline once the device has a Hebrew TTS voice
 * installed (varies by device; if none is available most engines still
 * attempt best-effort playback rather than silently failing). Cancels
 * anything already queued before speaking, so a rapid sequence of
 * announcements doesn't pile up and read out of order.
 */
export function speak(text: string): void {
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "he-IL";
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch {
    // TTS unsupported/blocked on this device - navigation still works visually.
  }
}

export function isSpeechSupported(): boolean {
  return "speechSynthesis" in window;
}

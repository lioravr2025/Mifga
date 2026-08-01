import { useEffect, useState } from "react";
import { getHebrewVoices, isSpeechSupported, type VoiceOption } from "../lib/speech";

/** Reactive list of Hebrew TTS voices available on this device - native TextToSpeech voices load once the engine finishes initializing (Android), Web Speech API voices often load asynchronously too (fires "voiceschanged"), so this starts empty and fills in once ready. */
export function useHebrewVoices(): VoiceOption[] {
  const [voices, setVoices] = useState<VoiceOption[]>([]);

  useEffect(() => {
    if (!isSpeechSupported()) return;
    let cancelled = false;
    const load = () => {
      getHebrewVoices().then((v) => {
        if (!cancelled) setVoices(v);
      });
    };
    load();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", load);
    }
    return () => {
      cancelled = true;
      if ("speechSynthesis" in window) window.speechSynthesis.removeEventListener("voiceschanged", load);
    };
  }, []);

  return voices;
}

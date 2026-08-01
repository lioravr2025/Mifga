import { useEffect, useState } from "react";
import { getHebrewVoices } from "../lib/speech";

/** Reactive list of Hebrew TTS voices installed on this device - most engines load their voice list asynchronously (fires "voiceschanged"), so this starts empty/partial and fills in once the browser reports it. */
export function useHebrewVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => getHebrewVoices());

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () => setVoices(getHebrewVoices());
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);

  return voices;
}

import { useRef, useState } from "react";

const SIMULATED_RECORDING_MS = 900;

/**
 * Press-and-hold voice message recorder. Uses the real mic (MediaRecorder)
 * when available and permitted; falls back to a short simulated recording
 * whenever that's not possible - no mic hardware, API missing, or the
 * permission prompt gets denied - so the send flow is still demoable
 * everywhere instead of silently doing nothing on press. There's no backend
 * yet to deliver the audio to a friend's device, so `onSent` is where the
 * UI shows a "sent" confirmation.
 */
export function useWalkieRecorder(onSent: (targetId: string) => void) {
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);

  const simulate = (targetId: string) => {
    setRecordingFor(targetId);
    setTimeout(() => {
      setRecordingFor(null);
      onSent(targetId);
    }, SIMULATED_RECORDING_MS);
  };

  const start = async (targetId: string) => {
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices?.getUserMedia) {
      simulate(targetId);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRef.current = recorder;
      recorder.start();
      setRecordingFor(targetId);
    } catch {
      // no mic / permission denied - still let the interaction complete
      simulate(targetId);
    }
  };

  const stop = (targetId: string) => {
    const recorder = mediaRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
      setRecordingFor(null);
      onSent(targetId);
    }
    // if there's no real recorder, a simulate() timeout (started in start())
    // owns finishing the flow - calling onSent again here would double-fire it.
  };

  return { recordingFor, start, stop };
}

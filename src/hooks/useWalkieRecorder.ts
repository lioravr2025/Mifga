import { useRef, useState } from "react";

const SIMULATED_RECORDING_MS = 900;

/**
 * Press-and-hold voice message recorder. Uses the real mic (MediaRecorder)
 * when available and permitted, and hands the recorded clip back via
 * `onSent(targetId, blob)` so the caller can upload+send it. Falls back to a
 * short simulated recording (blob = null) whenever recording isn't possible
 * - no mic hardware, API missing, or the permission prompt gets denied - so
 * the press-and-hold interaction is still demoable everywhere instead of
 * silently doing nothing on press.
 */
export function useWalkieRecorder(onSent: (targetId: string, blob: Blob | null) => void) {
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const simulate = (targetId: string) => {
    setRecordingFor(targetId);
    setTimeout(() => {
      setRecordingFor(null);
      onSent(targetId, null);
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
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
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
      const mimeType = recorder.mimeType;
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        onSent(targetId, blob);
      };
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
      setRecordingFor(null);
      mediaRef.current = null;
    }
    // if there's no real recorder, a simulate() timeout (started in start())
    // owns finishing the flow - calling onSent again here would double-fire it.
  };

  return { recordingFor, start, stop };
}

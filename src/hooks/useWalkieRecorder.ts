import { useRef, useState } from "react";

const SIMULATED_RECORDING_MS = 900;
const MAX_RECORDING_MS = 15_000;

/**
 * Press-and-hold voice message recorder. Uses the real mic (MediaRecorder)
 * when available and permitted, and hands the recorded clip back via
 * `onSent(targetId, blob)` so the caller can upload+send it. Falls back to a
 * short simulated recording (blob = null) whenever recording isn't possible
 * - no mic hardware, API missing, or the permission prompt gets denied - so
 * the press-and-hold interaction is still demoable everywhere instead of
 * silently doing nothing on press; the caller should treat blob === null as
 * "couldn't actually record" and tell the user, not as a successful send.
 *
 * Auto-stops and sends after MAX_RECORDING_MS so a held-too-long press can't
 * produce an endless clip.
 */
export function useWalkieRecorder(onSent: (targetId: string, blob: Blob | null) => void) {
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTargetRef = useRef<string | null>(null);

  const clearMaxTimer = () => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  };

  const simulate = (targetId: string) => {
    setRecordingFor(targetId);
    setTimeout(() => {
      setRecordingFor(null);
      activeTargetRef.current = null; // otherwise every future press is silently ignored - see start()'s guard
      onSent(targetId, null);
    }, SIMULATED_RECORDING_MS);
  };

  const start = async (targetId: string) => {
    // A press already in flight (e.g. a duplicate touchstart+mousedown firing
    // for the same gesture) shouldn't start a second, overlapping recording.
    if (activeTargetRef.current) return;
    activeTargetRef.current = targetId;

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
      maxTimerRef.current = setTimeout(() => stop(targetId), MAX_RECORDING_MS);
    } catch (err) {
      console.error("Mifga: mic recording unavailable", err);
      simulate(targetId);
    }
  };

  const stop = (targetId: string) => {
    clearMaxTimer();
    const recorder = mediaRef.current;
    if (recorder && recorder.state !== "inactive") {
      const mimeType = recorder.mimeType;
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        activeTargetRef.current = null;
        onSent(targetId, blob);
      };
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
      setRecordingFor(null);
      mediaRef.current = null;
    }
    // if there's no real recorder, a simulate() timeout (started in start())
    // owns finishing the flow and clearing activeTargetRef - calling onSent
    // again here would double-fire it.
  };

  /** OS-level gesture interruptions (a long-press context menu, a scroll takeover) fire touchcancel, not touchend - treat it the same as a release so the recorder never gets stuck mid-recording. */
  const cancel = (targetId: string) => {
    if (activeTargetRef.current === targetId) stop(targetId);
  };

  return { recordingFor, start, stop, cancel };
}

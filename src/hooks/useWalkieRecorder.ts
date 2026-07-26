import { useRef, useState } from "react";
import { base64ToBlob, isNative, MicRecorder } from "../lib/nativeMic";

const SIMULATED_RECORDING_MS = 900;
const MAX_RECORDING_MS = 15_000;

/**
 * Press-and-hold voice message recorder. On native Android builds, records
 * through MicRecorderPlugin (native MediaRecorder) instead of the browser's
 * getUserMedia() - the WebView's permission bridge for that kept failing
 * with NotAllowedError even with RECORD_AUDIO already granted at the OS
 * level, so recording is done natively instead of patching that bridge
 * further. On web (local dev/testing), falls back to getUserMedia().
 *
 * Either way, hands the recorded clip back via `onSent(targetId, blob)` so
 * the caller can upload+send it. Falls back to a short simulated recording
 * (blob = null) whenever recording isn't possible at all, so the
 * press-and-hold interaction is still demoable instead of silently doing
 * nothing on press; the caller should treat blob === null as "couldn't
 * actually record" and tell the user, not as a successful send.
 *
 * Auto-stops and sends after MAX_RECORDING_MS so a held-too-long press can't
 * produce an endless clip.
 */
export function useWalkieRecorder(onSent: (targetId: string, blob: Blob | null, errorReason?: string) => void) {
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

  const simulate = (targetId: string, errorReason?: string) => {
    setRecordingFor(targetId);
    setTimeout(() => {
      setRecordingFor(null);
      activeTargetRef.current = null; // otherwise every future press is silently ignored - see start()'s guard
      onSent(targetId, null, errorReason);
    }, SIMULATED_RECORDING_MS);
  };

  const start = async (targetId: string) => {
    // A press already in flight (e.g. a duplicate touchstart+mousedown firing
    // for the same gesture) shouldn't start a second, overlapping recording.
    if (activeTargetRef.current) return;
    activeTargetRef.current = targetId;

    if (isNative()) {
      try {
        await MicRecorder.start();
        setRecordingFor(targetId);
        maxTimerRef.current = setTimeout(() => stop(targetId), MAX_RECORDING_MS);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error("Mifga: native mic recording unavailable", err);
        simulate(targetId, reason);
      }
      return;
    }

    if (!("mediaDevices" in navigator) || !navigator.mediaDevices?.getUserMedia) {
      simulate(targetId, "getUserMedia-unsupported");
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
      // The DOMException name (NotAllowedError/NotFoundError/NotSupportedError/...)
      // is the only reliable way to tell "permission denied" apart from "no mic
      // hardware" or "insecure context" - surfacing it (instead of a generic
      // message) is what makes the next bug report actionable.
      const reason = err instanceof Error ? err.name || err.message : String(err);
      console.error("Mifga: mic recording unavailable", err);
      simulate(targetId, reason);
    }
  };

  const stop = (targetId: string) => {
    clearMaxTimer();

    if (isNative()) {
      if (activeTargetRef.current !== targetId) return; // simulate()/a prior stop already owns finishing this press
      MicRecorder.stop()
        .then(async ({ base64, mimeType }) => {
          const blob = await base64ToBlob(base64, mimeType);
          activeTargetRef.current = null;
          setRecordingFor(null);
          onSent(targetId, blob);
        })
        .catch((err) => {
          activeTargetRef.current = null;
          setRecordingFor(null);
          const reason = err instanceof Error ? err.message : String(err);
          console.error("Mifga: native mic stop failed", err);
          onSent(targetId, null, reason);
        });
      return;
    }

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

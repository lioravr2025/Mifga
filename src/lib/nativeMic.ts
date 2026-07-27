import { Capacitor, registerPlugin } from "@capacitor/core";

interface MicRecorderPlugin {
  start(): Promise<void>;
  stop(): Promise<{ base64: string; mimeType: string }>;
  play(options: { base64: string; mimeType: string }): Promise<void>;
}

/**
 * Native Android recording/playback (MediaRecorder/MediaPlayer), used instead
 * of the browser's getUserMedia()/Audio() APIs on native builds - the WebView
 * bridge for those (onPermissionRequest, autoplay policy) proved unreliable
 * across devices even with the OS-level mic permission already granted.
 * Only registered on native platforms; on web this plugin is never called.
 */
export const MicRecorder = registerPlugin<MicRecorderPlugin>("MicRecorder");

export const isNative = () => Capacitor.isNativePlatform();

export async function base64ToBlob(base64: string, mimeType: string): Promise<Blob> {
  const res = await fetch(`data:${mimeType};base64,${base64}`);
  return res.blob();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Plays a remote clip URL. On native builds, the audio is fetched here (over
 * the WebView's own already-warm connection to Supabase) and handed to the
 * native MediaPlayer as local base64 data instead of a URL - letting
 * MediaPlayer open its own independent network connection per clip was a
 * real source of end-to-end delay. Falls back to the DOM Audio element on
 * web (local dev/testing).
 */
export async function playAudioUrl(url: string): Promise<void> {
  if (isNative()) {
    const res = await fetch(url);
    const blob = await res.blob();
    const base64 = await blobToBase64(blob);
    await MicRecorder.play({ base64, mimeType: blob.type || "audio/mp4" });
    return;
  }
  await new Audio(url).play();
}

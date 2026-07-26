import { Capacitor, registerPlugin } from "@capacitor/core";

interface MicRecorderPlugin {
  start(): Promise<void>;
  stop(): Promise<{ base64: string; mimeType: string }>;
  play(options: { url: string }): Promise<void>;
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

/** Plays a remote/blob URL through the native MediaPlayer on native builds, falling back to the DOM Audio element on web. */
export async function playAudioUrl(url: string): Promise<void> {
  if (isNative()) {
    await MicRecorder.play({ url });
    return;
  }
  await new Audio(url).play();
}

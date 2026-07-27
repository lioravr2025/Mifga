import { registerPlugin } from "@capacitor/core";
import { isNative } from "./nativeMic";
import { supabase } from "./supabaseClient";

interface BackgroundRidePlugin {
  start(options: { uid: string; accessToken: string; refreshToken: string; radiusM: number }): Promise<void>;
  stop(): Promise<void>;
}

const BackgroundRide = registerPlugin<BackgroundRidePlugin>("BackgroundRide");

/**
 * Starts BackgroundRideService (native Android foreground service) so ride
 * tracking/hazard alerts/walkie messages keep working while the app is
 * backgrounded - see that service for the polling-based approach and its
 * real limitations (a few seconds of latency, and some phone manufacturers'
 * battery managers may still kill it despite being a proper foreground
 * service). No-op on web.
 */
export async function startBackgroundRide(uid: string, radiusM: number): Promise<void> {
  if (!isNative() || !supabase) return;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return;
  try {
    await BackgroundRide.start({
      uid,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      radiusM,
    });
  } catch (err) {
    console.error("Mifga: startBackgroundRide failed", err);
  }
}

export async function stopBackgroundRide(): Promise<void> {
  if (!isNative()) return;
  try {
    await BackgroundRide.stop();
  } catch (err) {
    console.error("Mifga: stopBackgroundRide failed", err);
  }
}

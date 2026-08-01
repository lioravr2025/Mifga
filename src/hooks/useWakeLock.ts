import { useEffect, useRef } from "react";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

interface NavigatorWithWakeLock {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
}

/**
 * Keeps the screen on while `active` is true (Wake Lock Web API - no native
 * plugin needed, supported by the Android/iOS system WebViews Capacitor
 * already runs on). The OS releases the lock automatically whenever the app
 * is backgrounded, so it's re-acquired on visibilitychange while still
 * active - same behavior Waze has during turn-by-turn navigation.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    const nav = navigator as unknown as NavigatorWithWakeLock;
    if (!active || !nav.wakeLock) return;

    let cancelled = false;

    const acquire = async () => {
      try {
        const sentinel = await nav.wakeLock!.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          sentinelRef.current = null;
        });
      } catch {
        // Permission/visibility-state edge cases (e.g. tab not visible yet) -
        // the visibilitychange listener below will retry once it's visible.
      }
    };

    acquire();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !sentinelRef.current) acquire();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [active]);
}

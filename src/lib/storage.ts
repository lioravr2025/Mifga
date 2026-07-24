// Tiny localStorage-backed persistence helper. Everything in Mifga v1 is
// local-only (no server) per the product brief, so app state just round
// trips through localStorage between sessions.
const PREFIX = "mifga:";

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full / unavailable (private mode) - fail silently, state just
    // won't persist across reloads.
  }
}

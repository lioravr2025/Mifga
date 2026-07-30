// Username format + uniqueness rules, used by onboarding/profile editing so
// every user in this local dataset has a distinct handle that friend search
// can rely on. There's no shared backend here, so "unique" is checked against
// this device's own friends list (the only pool of "other users" available
// locally) - a real deployment would check this against the server instead.
const USERNAME_PATTERN = /^[a-z][a-z0-9_.]{5,19}$/;

export function isValidUsernameFormat(raw: string): boolean {
  return USERNAME_PATTERN.test(raw.trim().toLowerCase());
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isUsernameTaken(raw: string, takenUsernames: string[], excludeUsername?: string): boolean {
  const normalized = normalizeUsername(raw);
  return takenUsernames.some((u) => u.toLowerCase() === normalized && u.toLowerCase() !== excludeUsername?.toLowerCase());
}

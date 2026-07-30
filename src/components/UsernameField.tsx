import { useEffect, useState } from "react";
import { AtSign, Check, Loader2, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { isUsernameTaken, isValidUsernameFormat } from "../lib/username";
import { isBackendConfigured } from "../lib/supabaseClient";
import { isUsernameTakenRemote } from "../lib/backend/auth";

const REMOTE_CHECK_DEBOUNCE_MS = 350;

/**
 * Username input with live format + uniqueness feedback. When a real backend
 * is configured, uniqueness is checked against the `profiles` table
 * (debounced); otherwise it falls back to this device's own friends list -
 * the only pool of "other users" a local-only build can see (see lib/username.ts).
 */
export default function UsernameField({
  value,
  onChange,
  excludeUsername,
  onValidityChange,
}: {
  value: string;
  onChange: (v: string) => void;
  /** pass the user's own current username when editing, so it doesn't flag itself as taken */
  excludeUsername?: string;
  onValidityChange?: (ok: boolean) => void;
}) {
  const { friends, user } = useApp();
  const trimmed = value.trim();
  // Grandfather in the rider's own current username even if it predates a
  // format rule (e.g. the 3->6 char minimum) - otherwise editing anything
  // else on the profile gets silently blocked by a field they never touched.
  const isUnchanged = excludeUsername !== undefined && trimmed.toLowerCase() === excludeUsername.toLowerCase();
  const formatValid = trimmed === "" || isUnchanged || isValidUsernameFormat(trimmed);
  const [remoteTaken, setRemoteTaken] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!isBackendConfigured || !trimmed || !formatValid) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const taken = await isUsernameTakenRemote(trimmed, user.id || undefined);
        if (!cancelled) setRemoteTaken(taken);
      } catch {
        if (!cancelled) setRemoteTaken(false); // fail open on network hiccups - the DB unique constraint is the real backstop
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, REMOTE_CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, formatValid, user.id]);

  const taken =
    trimmed !== "" &&
    formatValid &&
    (isBackendConfigured ? remoteTaken : isUsernameTaken(trimmed, friends.map((f) => f.username), excludeUsername));
  const pending = isBackendConfigured && checking;
  const available = trimmed !== "" && formatValid && !taken && !pending;

  useEffect(() => {
    onValidityChange?.(available);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available]);

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-panel2 border text-sm ${
          trimmed && !pending && (!formatValid || taken)
            ? "border-red-500"
            : available
            ? "border-green-500"
            : "border-bg-border focus-within:border-brand"
        }`}
      >
        <AtSign size={15} className="text-neutral-400 shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          placeholder="שם_משתמש"
          dir="ltr"
          className="flex-1 bg-transparent outline-none text-neutral-100 placeholder:text-neutral-500"
        />
        {pending && <Loader2 size={15} className="text-neutral-400 animate-spin shrink-0" />}
        {!pending && available && <Check size={15} className="text-green-400 shrink-0" />}
        {!pending && trimmed && (!formatValid || taken) && <X size={15} className="text-red-400 shrink-0" />}
      </div>
      {trimmed && !formatValid && (
        <p className="text-[11px] text-red-400 mt-1">6-20 תווים: אותיות באנגלית, ספרות, קו תחתון או נקודה, מתחיל באות</p>
      )}
      {trimmed && formatValid && !pending && taken && <p className="text-[11px] text-red-400 mt-1">שם המשתמש הזה כבר תפוס</p>}
      {available && <p className="text-[11px] text-green-400 mt-1">שם המשתמש פנוי</p>}
    </div>
  );
}

import { AtSign, Check, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { isUsernameTaken, isValidUsernameFormat } from "../lib/username";

/**
 * Username input with live format + uniqueness feedback. Uniqueness is
 * checked against this device's own friends list - the only pool of "other
 * users" available without a real backend (see lib/username.ts).
 */
export default function UsernameField({
  value,
  onChange,
  excludeUsername,
}: {
  value: string;
  onChange: (v: string) => void;
  /** pass the user's own current username when editing, so it doesn't flag itself as taken */
  excludeUsername?: string;
}) {
  const { friends } = useApp();
  const trimmed = value.trim();
  const formatValid = trimmed === "" || isValidUsernameFormat(trimmed);
  const taken = trimmed !== "" && formatValid && isUsernameTaken(trimmed, friends.map((f) => f.username), excludeUsername);
  const available = trimmed !== "" && formatValid && !taken;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-panel2 border text-sm ${
          trimmed && (!formatValid || taken) ? "border-red-500" : available ? "border-green-500" : "border-bg-border focus-within:border-brand"
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
        {available && <Check size={15} className="text-green-400 shrink-0" />}
        {trimmed && (!formatValid || taken) && <X size={15} className="text-red-400 shrink-0" />}
      </div>
      {trimmed && !formatValid && (
        <p className="text-[11px] text-red-400 mt-1">3-20 תווים: אותיות באנגלית, ספרות, קו תחתון או נקודה, מתחיל באות</p>
      )}
      {trimmed && formatValid && taken && <p className="text-[11px] text-red-400 mt-1">שם המשתמש הזה כבר תפוס</p>}
      {available && <p className="text-[11px] text-green-400 mt-1">שם המשתמש פנוי</p>}
    </div>
  );
}

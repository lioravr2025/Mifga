import { useState } from "react";
import { Check } from "lucide-react";
import { searchVehicleModels } from "../data/vehicleModels";
import type { VehicleTypeId } from "../types";

/** Free-text model input with suggestions from the curated local model list - picking a
 * suggestion or typing anything else (a model not in the list) both work equally. */
export default function VehicleModelInput({
  type,
  value,
  onChange,
}: {
  type: VehicleTypeId;
  value: string;
  onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const suggestions = searchVehicleModels(type, value);
  const showDropdown = focused && suggestions.length > 0 && !suggestions.includes(value.trim());

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="דגם הכלי (למשל: Xiaomi Pro 2)"
          className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
        />
      </div>
      {showDropdown && (
        <div className="absolute z-10 top-full inset-x-0 mt-1.5 rounded-2xl bg-bg-panel2 border border-bg-border shadow-2xl overflow-hidden max-h-48 overflow-y-auto no-scrollbar">
          {suggestions.map((m) => (
            <button
              key={m}
              onMouseDown={() => onChange(m)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-right text-xs text-neutral-200 active:bg-bg-panel border-b border-bg-border last:border-b-0"
            >
              {m}
              {m === value.trim() && <Check size={13} className="text-brand-light" />}
            </button>
          ))}
        </div>
      )}
      <p className="text-[10px] text-neutral-500 mt-1.5 px-1">לא מצאתם את הדגם שלכם? פשוט הקלידו אותו - הרשימה היא רק להצעה.</p>
    </div>
  );
}

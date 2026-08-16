import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MapPin } from "lucide-react";
import { fetchIsraeliCities } from "../lib/israeliCities";

/** Plain-text autocomplete over Israel's official city/settlement list - no map, just picking a name (used for the out-of-area waitlist form). */
export default function IsraeliCityAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
}) {
  const [allCities, setAllCities] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchIsraeliCities().then(setAllCities);
  }, []);

  const matches =
    allCities && value.trim().length > 0
      ? allCities.filter((c) => c.includes(value.trim())).slice(0, 8)
      : [];

  useEffect(() => {
    const showing = open && matches.length > 0;
    if (!showing) {
      setDropdownRect(null);
      return;
    }
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setDropdownRect({ top: r.bottom + 6, left: r.left, width: r.width });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, matches.length]);

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-panel2 border-2 border-bg-border transition-colors">
        {allCities === null ? (
          <Loader2 size={16} className="text-neutral-400 animate-spin shrink-0" />
        ) : (
          <MapPin size={16} className="text-neutral-400 shrink-0" />
        )}
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "עיר מגורים"}
          className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
        />
      </div>
      {open &&
        matches.length > 0 &&
        dropdownRect &&
        createPortal(
          <div
            style={{ position: "fixed", top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
            className="z-[5500] rounded-2xl bg-bg-panel2 border border-bg-border shadow-2xl overflow-hidden max-h-56 overflow-y-auto no-scrollbar"
          >
            {matches.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => {
                  onChange(city);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-right text-sm text-neutral-100 active:bg-bg-panel border-b border-bg-border last:border-b-0"
              >
                <MapPin size={14} className="text-brand-light shrink-0" />
                <span className="leading-relaxed truncate">{city}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

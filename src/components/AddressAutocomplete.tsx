import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MapPinned, Mic, Search } from "lucide-react";
import { isVoiceInputSupported, listenForAddress } from "../lib/nativeStt";
import type { LatLng } from "../types";

interface Suggestion {
  /** short, Waze-style label: "street number, city" - what's actually shown and filled into the field */
  label: string;
  /** full address, kept only as a fallback for places with no usable street/city breakdown */
  fullLabel: string;
  position: LatLng;
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  county?: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEBOUNCE_MS = 400;

/**
 * "street number, city" like Waze shows - Nominatim's raw display_name is a
 * full postal-style address (neighborhood, district, country, postcode)
 * which is far too verbose for a suggestion list.
 *
 * `typedNumber`: many Israeli residential streets simply aren't mapped down
 * to house-number granularity in OSM, so Nominatim returns a street-level
 * match with no house_number at all even for a query that included one.
 * Rather than silently dropping the number the user actually typed, this
 * appends it to the label on a best-effort basis when Nominatim didn't
 * confirm one itself - the pin still lands at the street-level coordinate
 * (the most precise thing actually available), only the displayed text
 * reflects what was typed.
 */
function shortLabel(name: string | undefined, address: NominatimAddress, fallback: string, typedNumber: string | null): string {
  const city = address.city || address.town || address.village || address.municipality || address.suburb || address.county;
  const parts: string[] = [];
  if (address.road) {
    const number = address.house_number || typedNumber;
    parts.push(number ? `${address.road} ${number}` : address.road);
  } else if (name) {
    parts.push(name);
  }
  if (city && city !== parts[0]) parts.push(city);
  return parts.length > 0 ? parts.join(", ") : fallback;
}

/** Pulls a standalone house-number-shaped token (1-4 digits, optionally suffixed with a single Hebrew letter like "13א") out of a free-typed address query. */
function extractTypedNumber(query: string): string | null {
  const m = query.match(/\b\d{1,4}[א-ת]?\b/);
  return m ? m[0] : null;
}

async function fetchSuggestions(query: string, biasNear: LatLng): Promise<Suggestion[]> {
  const typedNumber = extractTypedNumber(query);
  const url = `${NOMINATIM_URL}?format=json&addressdetails=1&accept-language=he&q=${encodeURIComponent(query)}&limit=5&viewbox=${
    biasNear.lng - 0.3
  },${biasNear.lat + 0.3},${biasNear.lng + 0.3},${biasNear.lat - 0.3}&bounded=0`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((d: { display_name: string; name?: string; address?: NominatimAddress; lat: string; lon: string }) => ({
    label: shortLabel(d.name, d.address ?? {}, d.display_name, typedNumber),
    fullLabel: d.display_name,
    position: { lat: parseFloat(d.lat), lng: parseFloat(d.lon) },
  }));
}

/** Debounced address search-as-you-type against Nominatim (free, keyless OSM geocoder). */
export default function AddressAutocomplete({
  biasNear,
  placeholder,
  onSelect,
  onQueryChange,
  autoFocus,
}: {
  biasNear: LatLng;
  placeholder?: string;
  onSelect: (s: { label: string; position: LatLng }) => void;
  /** fired on every keystroke, not just on picking a suggestion - lets a search box filter live while still offering the dropdown for a precise pick */
  onQueryChange?: (q: string) => void;
  /** focuses and visually highlights the field as soon as it mounts - for screens where this is the one thing to fill in (the route planner's destination box) */
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const startVoiceInput = async () => {
    setVoiceError(false);
    setListening(true);
    try {
      const text = await listenForAddress();
      if (text) {
        setQuery(text);
        onQueryChange?.(text);
        setOpen(true);
      }
    } catch {
      setVoiceError(true);
    } finally {
      setListening(false);
    }
  };

  // Screens embedding this field (e.g. the route planner) clip their header with
  // overflow-hidden for a slide-collapse animation, which was swallowing the
  // dropdown before it could ever be seen. Portal it to <body> instead, positioned
  // from the field's own screen coordinates so no ancestor's overflow can clip it.
  useEffect(() => {
    const showing = open && suggestions.length > 0;
    if (!showing) {
      setDropdownRect(null);
      return;
    }
    const updateRect = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (r) setDropdownRect({ top: r.bottom + 6, left: r.left, width: r.width });
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open, suggestions.length]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const results = await fetchSuggestions(query, biasNear);
        setSuggestions(results);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pick = (s: Suggestion) => {
    onSelect(s);
    setQuery(s.label);
    onQueryChange?.(s.label);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-panel2 border transition-colors ${
          autoFocus && !query ? "border-brand shadow-glow shadow-brand/40" : "border-bg-border"
        }`}
      >
        {loading ? <Loader2 size={16} className="text-neutral-400 animate-spin shrink-0" /> : <Search size={16} className="text-neutral-400 shrink-0" />}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onQueryChange?.(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "הקלידו כתובת..."}
          className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
        />
        {isVoiceInputSupported() && (
          <button
            type="button"
            onClick={startVoiceInput}
            disabled={listening}
            title={voiceError ? "לא הצלחנו לשמוע, נסו שוב" : "אמרו את הכתובת"}
            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition ${
              listening ? "bg-brand text-white animate-pulse" : voiceError ? "bg-red-500/15 text-red-400" : "bg-bg-panel text-neutral-400 active:scale-90"
            }`}
          >
            <Mic size={14} />
          </button>
        )}
      </div>
      {open &&
        suggestions.length > 0 &&
        dropdownRect &&
        createPortal(
          <div
            style={{ position: "fixed", top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
            // Higher than every current full-screen overlay (meetups/marketplace
            // at z-2500, the side menu at z-2600) - picked defensively high so a
            // future overlay added above those doesn't silently re-hide this
            // dropdown again the same way, since this component gets embedded
            // in whatever screen happens to need a location field.
            className="z-[3500] rounded-2xl bg-bg-panel2 border border-bg-border shadow-2xl overflow-hidden max-h-56 overflow-y-auto no-scrollbar"
          >
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => pick(s)}
                className="w-full flex items-center gap-2 px-4 py-3 text-right text-sm text-neutral-100 active:bg-bg-panel border-b border-bg-border last:border-b-0"
              >
                <MapPinned size={14} className="text-brand-light shrink-0" />
                <span className="leading-relaxed truncate">{s.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

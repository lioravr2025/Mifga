import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MapPinned, Search } from "lucide-react";
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

/** "street number, city" like Waze shows - Nominatim's raw display_name is a full postal-style address (neighborhood, district, country, postcode) which is far too verbose for a suggestion list. */
function shortLabel(name: string | undefined, address: NominatimAddress, fallback: string): string {
  const city = address.city || address.town || address.village || address.municipality || address.suburb || address.county;
  const parts: string[] = [];
  if (address.road) {
    parts.push(address.house_number ? `${address.road} ${address.house_number}` : address.road);
  } else if (name) {
    parts.push(name);
  }
  if (city && city !== parts[0]) parts.push(city);
  return parts.length > 0 ? parts.join(", ") : fallback;
}

async function fetchSuggestions(query: string, biasNear: LatLng): Promise<Suggestion[]> {
  const url = `${NOMINATIM_URL}?format=json&addressdetails=1&q=${encodeURIComponent(query)}&limit=5&viewbox=${biasNear.lng - 0.3},${
    biasNear.lat + 0.3
  },${biasNear.lng + 0.3},${biasNear.lat - 0.3}&bounded=0`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((d: { display_name: string; name?: string; address?: NominatimAddress; lat: string; lon: string }) => ({
    label: shortLabel(d.name, d.address ?? {}, d.display_name),
    fullLabel: d.display_name,
    position: { lat: parseFloat(d.lat), lng: parseFloat(d.lon) },
  }));
}

/** Debounced address search-as-you-type against Nominatim (free, keyless OSM geocoder). */
export default function AddressAutocomplete({
  biasNear,
  placeholder,
  onSelect,
}: {
  biasNear: LatLng;
  placeholder?: string;
  onSelect: (s: { label: string; position: LatLng }) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border">
        {loading ? <Loader2 size={16} className="text-neutral-400 animate-spin shrink-0" /> : <Search size={16} className="text-neutral-400 shrink-0" />}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "הקלידו כתובת..."}
          className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
        />
      </div>
      {open &&
        suggestions.length > 0 &&
        dropdownRect &&
        createPortal(
          <div
            style={{ position: "fixed", top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
            className="z-[2000] rounded-2xl bg-bg-panel2 border border-bg-border shadow-2xl overflow-hidden max-h-56 overflow-y-auto no-scrollbar"
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

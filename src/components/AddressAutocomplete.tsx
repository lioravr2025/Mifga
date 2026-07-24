import { useEffect, useRef, useState } from "react";
import { Loader2, MapPinned, Search } from "lucide-react";
import type { LatLng } from "../types";

interface Suggestion {
  label: string;
  position: LatLng;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEBOUNCE_MS = 400;

async function fetchSuggestions(query: string, biasNear: LatLng): Promise<Suggestion[]> {
  const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query)}&limit=5&viewbox=${biasNear.lng - 0.3},${biasNear.lat + 0.3},${
    biasNear.lng + 0.3
  },${biasNear.lat - 0.3}&bounded=0`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((d: { display_name: string; lat: string; lon: string }) => ({
    label: d.display_name,
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    <div className="relative">
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
      {open && suggestions.length > 0 && (
        <div className="absolute z-10 top-full inset-x-0 mt-1.5 rounded-2xl bg-bg-panel2 border border-bg-border shadow-2xl overflow-hidden max-h-56 overflow-y-auto no-scrollbar">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => pick(s)}
              className="w-full flex items-start gap-2 px-4 py-3 text-right text-xs text-neutral-200 active:bg-bg-panel border-b border-bg-border last:border-b-0"
            >
              <MapPinned size={14} className="text-brand-light shrink-0 mt-0.5" />
              <span className="leading-relaxed">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

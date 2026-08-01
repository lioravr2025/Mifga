import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Loader2, MapPinned, Search } from "lucide-react";
import { hazardMapIcon } from "../lib/hazardTypes";

interface Suggestion {
  label: string;
  lat: number;
  lng: number;
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEBOUNCE_MS = 400;
const TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ISRAEL_CENTER: [number, number] = [31.5, 34.9];

function shortLabel(name: string | undefined, address: NominatimAddress, fallback: string): string {
  const city = address.city || address.town || address.village || address.municipality || address.suburb;
  const parts: string[] = [];
  if (address.road) parts.push(address.house_number ? `${address.road} ${address.house_number}` : address.road);
  else if (name) parts.push(name);
  if (city && city !== parts[0]) parts.push(city);
  return parts.length > 0 ? parts.join(", ") : fallback;
}

async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  const url = `${NOMINATIM_URL}?format=json&addressdetails=1&accept-language=he&q=${encodeURIComponent(query)}&limit=5&countrycodes=il`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((d: { display_name: string; name?: string; address?: NominatimAddress; lat: string; lon: string }) => ({
    label: shortLabel(d.name, d.address ?? {}, d.display_name),
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
  }));
}

/** Recenters the map whenever the picked point changes (e.g. from picking a search suggestion). */
function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [lat, lng]);
  return null;
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/**
 * Address search-as-you-type (Nominatim) + a small map to fine-tune the exact
 * spot by clicking - used for seeding a police/inspector hazard at a specific
 * street rather than scattered across a whole city (see SeedPanel).
 */
export default function AddressPickerMap({
  hazardType,
  value,
  onChange,
}: {
  hazardType: string;
  value: { lat: number; lng: number } | null;
  onChange: (pos: { lat: number; lng: number }) => void;
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
        setSuggestions(await fetchSuggestions(query));
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const pick = (s: Suggestion) => {
    setQuery(s.label);
    setOpen(false);
    onChange({ lat: s.lat, lng: s.lng });
  };

  const center = value ?? { lat: ISRAEL_CENTER[0], lng: ISRAEL_CENTER[1] };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border">
          {loading ? <Loader2 size={15} className="text-neutral-400 animate-spin shrink-0" /> : <Search size={15} className="text-neutral-400 shrink-0" />}
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="חיפוש רחוב וכתובת..."
            className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
          />
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute z-[1000] top-full mt-1 inset-x-0 rounded-xl bg-bg-panel2 border border-bg-border shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => pick(s)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-right text-sm text-neutral-100 active:bg-bg-panel border-b border-bg-border last:border-b-0"
              >
                <MapPinned size={13} className="text-brand-light shrink-0" />
                <span className="leading-relaxed truncate">{s.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-neutral-500">אפשר גם ללחוץ ישירות על המפה כדי לכוון את הנקודה המדויקת.</p>

      <div className="h-56 rounded-xl overflow-hidden border border-bg-border">
        <MapContainer center={[center.lat, center.lng]} zoom={value ? 15 : 7} style={{ height: "100%", width: "100%" }}>
          <TileLayer url={TILES} />
          <ClickToPlace onPick={(lat, lng) => onChange({ lat, lng })} />
          {value && (
            <>
              <FlyTo lat={value.lat} lng={value.lng} />
              <Marker position={[value.lat, value.lng]} icon={hazardMapIcon(hazardType)} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

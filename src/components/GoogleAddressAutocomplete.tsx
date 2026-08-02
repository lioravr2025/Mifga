import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MapPinned, Mic, Search, X } from "lucide-react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { isVoiceInputSupported, listenForAddress } from "../lib/nativeStt";
import type { LatLng } from "../types";

// Google Maps experiment equivalent of AddressAutocomplete.tsx (Nominatim) -
// same props/behavior (debounce, voice input, clear button, portal dropdown),
// swapped to Google's Places Autocomplete + Place Details for geocoding.
// Notably fixes the house-number gap Nominatim had for Israeli residential
// streets - Google's address database has much denser house-number coverage.
const DEBOUNCE_MS = 300;

interface Suggestion {
  placeId: string;
  label: string;
}

export default function GoogleAddressAutocomplete({
  biasNear,
  placeholder,
  onSelect,
  onQueryChange,
  highlight,
}: {
  biasNear: LatLng;
  placeholder?: string;
  onSelect: (s: { label: string; position: LatLng }) => void;
  onQueryChange?: (q: string) => void;
  highlight?: boolean;
}) {
  const placesLib = useMapsLibrary("places");
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
  const skipNextDebounceRef = useRef(false);

  // Predictions carry their own .toPlace() handle (modern Places API, replacing
  // the legacy AutocompleteService/PlacesService pair that new Cloud projects
  // like this one don't get access to at all - see the ApiTargetBlockedMapError
  // this threw when first tried with the legacy classes).
  const predictionsRef = useRef<Map<string, google.maps.places.PlacePrediction>>(new Map());
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (!placesLib) return;
    sessionToken.current = new placesLib.AutocompleteSessionToken();
  }, [placesLib]);

  const clear = () => {
    setQuery("");
    onQueryChange?.("");
    setSuggestions([]);
    setOpen(false);
  };

  const runSearch = async (q: string) => {
    if (!placesLib) return;
    setLoading(true);
    try {
      const { suggestions: results } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        sessionToken: sessionToken.current ?? undefined,
        locationBias: { center: { lat: biasNear.lat, lng: biasNear.lng }, radius: 30_000 } as google.maps.places.LocationBias,
        includedRegionCodes: ["il"],
        language: "he",
      });
      const predictions = results.map((s) => s.placePrediction).filter((p): p is google.maps.places.PlacePrediction => p !== null);
      predictionsRef.current = new Map(predictions.map((p) => [p.placeId, p]));
      setSuggestions(predictions.map((p) => ({ placeId: p.placeId, label: p.text.text })));
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const startVoiceInput = async () => {
    setVoiceError(false);
    setListening(true);
    try {
      const text = await listenForAddress();
      if (text) {
        skipNextDebounceRef.current = true;
        setQuery(text);
        onQueryChange?.(text);
        setOpen(true);
        runSearch(text);
      }
    } catch {
      setVoiceError(true);
    } finally {
      setListening(false);
    }
  };

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
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return;
    }
    if (query.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    timer.current = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pick = async (s: Suggestion) => {
    const prediction = predictionsRef.current.get(s.placeId);
    if (!prediction) return;
    try {
      const { place } = await prediction.toPlace().fetchFields({ fields: ["location"] });
      if (!place.location) return;
      const position = { lat: place.location.lat(), lng: place.location.lng() };
      onSelect({ label: s.label, position });
      setQuery(s.label);
      onQueryChange?.(s.label);
      setOpen(false);
      // A fresh session token per completed search - billing best practice,
      // groups the keystrokes+fetchFields call into one Autocomplete session.
      if (placesLib) sessionToken.current = new placesLib.AutocompleteSessionToken();
    } catch {
      // best-effort - leave the dropdown open so the rider can try another suggestion
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-panel2 border-2 transition-colors ${
          highlight && !query ? "border-white shadow-glow shadow-white/30" : "border-bg-border"
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
          readOnly={listening}
          placeholder={listening ? "מקשיב..." : placeholder ?? "הקלידו כתובת..."}
          className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
        />
        {query.length > 0 && !listening && (
          <button type="button" onClick={clear} title="נקה" className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-neutral-400 active:scale-90 transition">
            <X size={15} />
          </button>
        )}
        {isVoiceInputSupported() && (
          <div className="relative shrink-0">
            {listening && <span className="absolute inset-0 rounded-full bg-brand animate-ping" />}
            <button
              type="button"
              onClick={startVoiceInput}
              disabled={listening}
              title={voiceError ? "לא הצלחנו לשמוע, נסו שוב" : "אמרו את הכתובת"}
              className={`relative w-7 h-7 rounded-full flex items-center justify-center transition ${
                listening ? "bg-brand text-white" : voiceError ? "bg-red-500/15 text-red-400" : "bg-bg-panel text-neutral-400 active:scale-90"
              }`}
            >
              <Mic size={14} />
            </button>
          </div>
        )}
      </div>
      {open &&
        suggestions.length > 0 &&
        dropdownRect &&
        createPortal(
          <div
            style={{ position: "fixed", top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
            className="z-[3500] rounded-2xl bg-bg-panel2 border border-bg-border shadow-2xl overflow-hidden max-h-56 overflow-y-auto no-scrollbar"
          >
            {suggestions.map((s) => (
              <button
                key={s.placeId}
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

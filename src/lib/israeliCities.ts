const CITIES_RESOURCE_URL =
  "https://data.gov.il/api/3/action/datastore_search?resource_id=d4901968-dad3-4845-a9b0-a57d027f11ab&limit=1300";

// One real network call for the whole app session (module-level cache, not
// per mount) - Israel's official settlements registry (Ministry of Interior
// / data.gov.il), not a hand-typed list. Shared by the city-name picker
// (out-of-area waitlist form) and by voice-search biasing (nativeStt.ts).
let citiesPromise: Promise<string[]> | null = null;

export function fetchIsraeliCities(): Promise<string[]> {
  if (!citiesPromise) {
    citiesPromise = fetch(CITIES_RESOURCE_URL)
      .then((res) => res.json())
      .then((data) => {
        const records = (data?.result?.records ?? []) as { שם_ישוב?: string }[];
        const names = records.map((r) => (r["שם_ישוב"] ?? "").trim()).filter(Boolean);
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "he"));
      })
      .catch(() => []);
  }
  return citiesPromise;
}

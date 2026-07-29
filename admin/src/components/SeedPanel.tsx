import { useState } from "react";
import { Gift, Shuffle, Siren } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { HAZARD_TYPE_OPTIONS } from "../lib/hazardTypes";
import { ISRAELI_CITIES } from "../lib/cities";
import { Card } from "./Card";

const SCATTER_RADIUS_M = 3000;
const PRIZE_EMOJIS = ["🎁", "🏆", "⭐", "💰", "🪙", "💎", "🎉", "🔶"];

export default function SeedPanel() {
  const [mode, setMode] = useState<"hazard" | "prize">("hazard");

  // hazard mode
  const [hazardType, setHazardType] = useState(HAZARD_TYPE_OPTIONS[0].id);
  const [hazardCity, setHazardCity] = useState(ISRAELI_CITIES[0].name);
  const [hazardCount, setHazardCount] = useState(5);

  // prize mode
  const [prizeIcon, setPrizeIcon] = useState(PRIZE_EMOJIS[0]);
  const [prizePoints, setPrizePoints] = useState(10);
  const [prizeCount, setPrizeCount] = useState(5);
  const [prizeCities, setPrizeCities] = useState<string[]>([ISRAELI_CITIES[0].name]);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const togglePrizeCity = (name: string) => {
    setPrizeCities((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  };

  const sendHazards = async () => {
    const city = ISRAELI_CITIES.find((c) => c.name === hazardCity);
    if (!city) return;
    setRunning(true);
    setError(null);
    setResult(null);
    const { data, error: err } = await supabase.rpc("admin_seed_hazards", {
      p_type: hazardType,
      p_lat: city.lat,
      p_lng: city.lng,
      p_radius_m: SCATTER_RADIUS_M,
      p_count: hazardCount,
    });
    setRunning(false);
    if (err) {
      setError(err.message);
      return;
    }
    setResult(`פוזרו ${data} דיווחי "${HAZARD_TYPE_OPTIONS.find((o) => o.id === hazardType)?.label}" באזור ${hazardCity}.`);
  };

  const sendPrizes = async () => {
    if (prizeCities.length === 0) {
      setError("בחרו לפחות עיר אחת");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    let total = 0;
    for (const cityName of prizeCities) {
      const city = ISRAELI_CITIES.find((c) => c.name === cityName);
      if (!city) continue;
      const { data, error: err } = await supabase.rpc("admin_seed_prizes", {
        p_icon: prizeIcon,
        p_points: prizePoints,
        p_lat: city.lat,
        p_lng: city.lng,
        p_radius_m: SCATTER_RADIUS_M,
        p_count: prizeCount,
      });
      if (err) {
        setRunning(false);
        setError(`${err.message} (נעצר באזור ${cityName})`);
        return;
      }
      total += data as number;
    }
    setRunning(false);
    setResult(`פוזרו ${total} פרסים (${prizePoints} נק' כל אחד) ב-${prizeCities.length} ערים.`);
  };

  return (
    <Card title="פיזור מפגעים ופרסים" icon={<Shuffle size={16} className="text-brand-light" />}>
      <p className="text-[11px] text-neutral-500 mb-3 leading-relaxed">
        יוצר נתונים מלאכותיים על המפה - שוטרים/פקחים ייעלמו אוטומטית אחרי 20 דקות אם אף אחד לא מאשר שהם עדיין שם, בדיוק כמו
        דיווח אמיתי. פרסים נעלמים לכולם ברגע שמישהו אוסף אותם.
      </p>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("hazard")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-semibold transition ${
            mode === "hazard" ? "bg-brand/15 border-brand text-brand-light" : "bg-bg-panel border-bg-border text-neutral-400"
          }`}
        >
          <Siren size={14} />
          מפגעים
        </button>
        <button
          onClick={() => setMode("prize")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-semibold transition ${
            mode === "prize" ? "bg-amber-500/15 border-amber-500 text-amber-300" : "bg-bg-panel border-bg-border text-neutral-400"
          }`}
        >
          <Gift size={14} />
          פרסים
        </button>
      </div>

      {mode === "hazard" ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">סוג מפגע</label>
            <select
              value={hazardType}
              onChange={(e) => setHazardType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
            >
              {HAZARD_TYPE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">עיר</label>
            <select
              value={hazardCity}
              onChange={(e) => setHazardCity(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
            >
              {ISRAELI_CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">כמות (מקסימום 200)</label>
            <input
              type="number"
              min={1}
              max={200}
              value={hazardCount}
              onChange={(e) => setHazardCount(Math.max(1, Math.min(200, Number(e.target.value))))}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
            />
          </div>
          <button
            onClick={sendHazards}
            disabled={running}
            className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-bold active:scale-95 transition disabled:opacity-40"
          >
            {running ? "מפזר..." : "פיזור"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">איקון לפרס</label>
            <div className="flex flex-wrap gap-2">
              {PRIZE_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setPrizeIcon(e)}
                  className={`w-10 h-10 rounded-xl border text-lg flex items-center justify-center transition ${
                    prizeIcon === e ? "bg-amber-500/15 border-amber-500" : "bg-bg-panel border-bg-border"
                  }`}
                >
                  {e}
                </button>
              ))}
              <input
                value={prizeIcon}
                onChange={(e) => setPrizeIcon(e.target.value.slice(0, 4))}
                className="w-16 px-2 py-2 rounded-xl bg-bg-panel border border-bg-border text-center text-sm text-neutral-100 outline-none focus:border-brand"
                placeholder="אחר"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">נקודות לפרס</label>
              <input
                type="number"
                min={1}
                value={prizePoints}
                onChange={(e) => setPrizePoints(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">כמות לכל עיר</label>
              <input
                type="number"
                min={1}
                max={200}
                value={prizeCount}
                onChange={(e) => setPrizeCount(Math.max(1, Math.min(200, Number(e.target.value))))}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">ערים ({prizeCities.length} נבחרו)</label>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-bg-border p-2">
              {ISRAELI_CITIES.map((c) => (
                <label key={c.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-neutral-200 active:bg-bg-panel">
                  <input type="checkbox" checked={prizeCities.includes(c.name)} onChange={() => togglePrizeCity(c.name)} className="accent-amber-500" />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={sendPrizes}
            disabled={running}
            className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold active:scale-95 transition disabled:opacity-40"
          >
            {running ? "מפזר..." : "פיזור"}
          </button>
        </div>
      )}

      {result && <div className="mt-3 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-xs text-green-300">{result}</div>}
      {error && <div className="mt-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-300">{error}</div>}
    </Card>
  );
}

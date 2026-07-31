import { useRef, useState } from "react";
import { Gift, ImagePlus, MapPin, Shuffle, Siren, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { HAZARD_TYPE_OPTIONS } from "../lib/hazardTypes";
import { ISRAELI_CITIES } from "../lib/cities";
import { Card } from "./Card";
import AddressPickerMap from "./AddressPickerMap";

const SCATTER_RADIUS_M = 3000;
// A specific street pick should land right there, not scatter across a
// whole neighborhood the way the city-wide radius does.
const ADDRESS_RADIUS_M = 40;
const PRIZE_EMOJIS = ["🎁", "🏆", "⭐", "💰", "🪙", "💎", "🎉", "🔶"];
// Only these two are ever placed one at a time at a real, specific spot -
// every other type is inherently a "somewhere in this area" scatter.
const ADDRESS_PICKABLE_TYPES = ["police", "inspector"];

export default function SeedPanel() {
  const [mode, setMode] = useState<"hazard" | "prize">("hazard");

  // hazard mode
  const [hazardType, setHazardType] = useState(HAZARD_TYPE_OPTIONS[0].id);
  const [hazardCity, setHazardCity] = useState(ISRAELI_CITIES[0].name);
  const [hazardCount, setHazardCount] = useState(5);
  const [hazardLocationMode, setHazardLocationMode] = useState<"city" | "address">("city");
  const [hazardAddress, setHazardAddress] = useState<{ lat: number; lng: number } | null>(null);

  // prize mode
  const [prizeIcon, setPrizeIcon] = useState(PRIZE_EMOJIS[0]);
  const [prizeImage, setPrizeImage] = useState<string | null>(null);
  const [prizePoints, setPrizePoints] = useState(10);
  const [prizeCount, setPrizeCount] = useState(5);
  const [prizeCities, setPrizeCities] = useState<string[]>([ISRAELI_CITIES[0].name]);
  const [prizeCollectMode, setPrizeCollectMode] = useState<"single" | "multi">("single");
  const fileRef = useRef<HTMLInputElement>(null);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPrizeImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const togglePrizeCity = (name: string) => {
    setPrizeCities((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  };

  const useAddressMode = ADDRESS_PICKABLE_TYPES.includes(hazardType) && hazardLocationMode === "address";

  const sendHazards = async () => {
    const point = useAddressMode ? hazardAddress : ISRAELI_CITIES.find((c) => c.name === hazardCity);
    if (!point) {
      if (useAddressMode) setError("בחרו כתובת קודם");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    const { data, error: err } = await supabase.rpc("admin_seed_hazards", {
      p_type: hazardType,
      p_lat: point.lat,
      p_lng: point.lng,
      p_radius_m: useAddressMode ? ADDRESS_RADIUS_M : SCATTER_RADIUS_M,
      p_count: hazardCount,
    });
    setRunning(false);
    if (err) {
      setError(err.message);
      return;
    }
    const label = HAZARD_TYPE_OPTIONS.find((o) => o.id === hazardType)?.label;
    setResult(useAddressMode ? `פוזרו ${data} דיווחי "${label}" בכתובת שנבחרה.` : `פוזרו ${data} דיווחי "${label}" באזור ${hazardCity}.`);
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
        p_icon_image_url: prizeImage,
        p_collect_mode: prizeCollectMode,
      });
      if (err) {
        setRunning(false);
        setError(`${err.message} (נעצר באזור ${cityName})`);
        return;
      }
      total += data as number;
    }
    setRunning(false);
    const modeLabel = prizeCollectMode === "multi" ? "איסוף מרובה" : "איסוף חד-פעמי";
    setResult(`פוזרו ${total} פרסים (${prizePoints} נק' כל אחד, ${modeLabel}) ב-${prizeCities.length} ערים.`);
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
              onChange={(e) => {
                setHazardType(e.target.value);
                if (!ADDRESS_PICKABLE_TYPES.includes(e.target.value)) setHazardLocationMode("city");
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
            >
              {HAZARD_TYPE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {ADDRESS_PICKABLE_TYPES.includes(hazardType) && (
            <div className="flex gap-2">
              <button
                onClick={() => setHazardLocationMode("city")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition ${
                  hazardLocationMode === "city" ? "bg-brand/15 border-brand text-brand-light" : "bg-bg-panel border-bg-border text-neutral-400"
                }`}
              >
                <Shuffle size={12} />
                פיזור בעיר
              </button>
              <button
                onClick={() => setHazardLocationMode("address")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition ${
                  hazardLocationMode === "address" ? "bg-brand/15 border-brand text-brand-light" : "bg-bg-panel border-bg-border text-neutral-400"
                }`}
              >
                <MapPin size={12} />
                כתובת מדויקת
              </button>
            </div>
          )}

          {useAddressMode ? (
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">כתובת</label>
              <AddressPickerMap hazardType={hazardType} value={hazardAddress} onChange={setHazardAddress} />
            </div>
          ) : (
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
          )}
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
            disabled={running || (useAddressMode && !hazardAddress)}
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

          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">או תמונה משלכם (עדיפות על האיקון למעלה)</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
            {prizeImage ? (
              <div className="flex items-center gap-3">
                <img src={prizeImage} alt="" className="w-14 h-14 rounded-xl object-cover border border-bg-border" />
                <button
                  onClick={() => {
                    setPrizeImage(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-xs text-neutral-300 active:scale-95 transition"
                >
                  <X size={13} />
                  הסרת תמונה
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-bg-panel border border-dashed border-bg-border text-xs text-neutral-400 active:scale-95 transition"
              >
                <ImagePlus size={14} />
                העלאת תמונה
              </button>
            )}
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
            <label className="text-xs text-neutral-400 mb-1.5 block">אופן איסוף</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPrizeCollectMode("single")}
                className={`flex-1 flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-right transition ${
                  prizeCollectMode === "single" ? "bg-amber-500/15 border-amber-500" : "bg-bg-panel border-bg-border"
                }`}
              >
                <span className="text-xs font-semibold text-neutral-100">חד-פעמי</span>
                <span className="text-[10px] text-neutral-500">הראשון שמגיע לוקח - נעלם לכולם</span>
              </button>
              <button
                onClick={() => setPrizeCollectMode("multi")}
                className={`flex-1 flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-right transition ${
                  prizeCollectMode === "multi" ? "bg-amber-500/15 border-amber-500" : "bg-bg-panel border-bg-border"
                }`}
              >
                <span className="text-xs font-semibold text-neutral-100">מרובה</span>
                <span className="text-[10px] text-neutral-500">כל מי שעובר בטווח מקבל נקודות</span>
              </button>
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

import { useEffect, useState } from "react";
import { MapPin, Save } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { AppConfigRow } from "../lib/types";
import { Card } from "./Card";

export default function ServiceAreaPanel() {
  const [config, setConfig] = useState<AppConfigRow | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("app_config")
      .select("*")
      .single()
      .then(({ data }) => setConfig(data as AppConfigRow));
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    await supabase.from("app_config").update(config).eq("id", true);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!config) return null;

  return (
    <Card title="אזור שירות (השקת פיילוט)" icon={<MapPin size={16} className="text-brand-light" />}>
      <div className="flex items-center justify-between p-3 rounded-xl bg-bg-panel border border-bg-border mb-3">
        <div>
          <div className="text-sm font-semibold text-neutral-100">הגבלת דיווח לאזור</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {config.service_area_enabled
              ? "רוכבים מחוץ לאזור רואים מפה וניווט כרגיל, אבל לא יכולים לדווח - במקום זה מוצעת הרשמה לרשימת המתנה."
              : "כבוי - כל רוכב בכל מקום יכול לדווח, בלי הגבלה."}
          </div>
        </div>
        <button
          onClick={() => setConfig({ ...config, service_area_enabled: !config.service_area_enabled })}
          className={`shrink-0 w-12 h-7 rounded-full relative transition ms-3 ${config.service_area_enabled ? "bg-brand" : "bg-neutral-600"}`}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${config.service_area_enabled ? "right-0.5" : "right-[22px]"}`}
          />
        </button>
      </div>

      <label className="text-xs text-neutral-400 mb-1 block">שם העיר (מוצג לרוכבים)</label>
      <input
        value={config.service_area_city_name}
        onChange={(e) => setConfig({ ...config, service_area_city_name: e.target.value })}
        className="w-full mb-3 px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
      />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-neutral-400 mb-1 block">Latitude</label>
          <input
            type="number"
            step="0.0001"
            value={config.service_area_lat}
            onChange={(e) => setConfig({ ...config, service_area_lat: Number(e.target.value) })}
            dir="ltr"
            className="w-full px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-400 mb-1 block">Longitude</label>
          <input
            type="number"
            step="0.0001"
            value={config.service_area_lng}
            onChange={(e) => setConfig({ ...config, service_area_lng: Number(e.target.value) })}
            dir="ltr"
            className="w-full px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
          />
        </div>
      </div>

      <label className="text-xs text-neutral-400 mb-1 block">רדיוס (ק"מ)</label>
      <input
        type="number"
        step="0.5"
        value={config.service_area_radius_km}
        onChange={(e) => setConfig({ ...config, service_area_radius_km: Number(e.target.value) })}
        dir="ltr"
        className="w-full mb-3 px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
      />

      <label className="text-xs text-neutral-400 mb-1 block">הודעה לרוכבים מחוץ לאזור</label>
      <textarea
        value={config.service_area_message}
        onChange={(e) => setConfig({ ...config, service_area_message: e.target.value })}
        rows={2}
        className="w-full mb-3 px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand resize-none"
      />

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold active:scale-95 transition disabled:opacity-40"
      >
        <Save size={14} />
        {saved ? "נשמר!" : "שמירה"}
      </button>
    </Card>
  );
}

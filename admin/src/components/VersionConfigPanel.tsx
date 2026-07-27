import { useEffect, useState } from "react";
import { Save, Smartphone } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { AppConfigRow } from "../lib/types";
import { Card } from "./Card";

export default function VersionConfigPanel() {
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
    <Card title="ניהול גרסאות" icon={<Smartphone size={16} className="text-brand-light" />}>
      <p className="text-[11px] text-neutral-500 mb-3">
        אם "גרסה מינימלית נדרשת" גבוהה מהגרסה שמותקנת אצל משתמש, האפליקציה תציג לו מסך חובה לעדכון.
      </p>
      <label className="text-xs text-neutral-400 mb-1 block">גרסה עדכנית ביותר</label>
      <input
        value={config.latest_version ?? ""}
        onChange={(e) => setConfig({ ...config, latest_version: e.target.value })}
        placeholder="לדוגמה: 0.3.0"
        dir="ltr"
        className="w-full mb-3 px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
      />
      <label className="text-xs text-neutral-400 mb-1 block">גרסה מינימלית נדרשת (חובה לעדכן)</label>
      <input
        value={config.min_required_version ?? ""}
        onChange={(e) => setConfig({ ...config, min_required_version: e.target.value })}
        placeholder="השאירו ריק כדי לא לאכוף עדכון"
        dir="ltr"
        className="w-full mb-3 px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
      />
      <label className="text-xs text-neutral-400 mb-1 block">הודעה למשתמש (אופציונלי)</label>
      <input
        value={config.update_message ?? ""}
        onChange={(e) => setConfig({ ...config, update_message: e.target.value })}
        placeholder="יש עדכון חדש עם תיקונים חשובים"
        className="w-full mb-3 px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
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

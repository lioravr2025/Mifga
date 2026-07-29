import { useEffect, useState } from "react";
import { Save, Smartphone } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { AppConfigRow } from "../lib/types";
import { Card } from "./Card";

export default function VersionConfigPanel() {
  const [config, setConfig] = useState<AppConfigRow | null>(null);
  const [mandatory, setMandatory] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("app_config")
      .select("*")
      .single()
      .then(({ data }) => {
        const row = data as AppConfigRow;
        setConfig(row);
        setMandatory(!!row?.min_required_version);
      });
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    // "Mandatory" and "optional" both live in min_required_version: set equal to
    // latest_version to hard-block anyone below it, or cleared to just show an
    // optional, dismissible nudge (see UpdateNudge on the mobile app).
    const nextMinRequired = mandatory ? config.latest_version : null;
    const payload = { ...config, min_required_version: nextMinRequired };
    await supabase.from("app_config").update(payload).eq("id", true);
    setConfig(payload);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!config) return null;

  return (
    <Card title="ניהול גרסאות" icon={<Smartphone size={16} className="text-brand-light" />}>
      <label className="text-xs text-neutral-400 mb-1 block">גרסה עדכנית ביותר</label>
      <input
        value={config.latest_version ?? ""}
        onChange={(e) => setConfig({ ...config, latest_version: e.target.value })}
        placeholder="לדוגמה: 0.6.3"
        dir="ltr"
        className="w-full mb-3 px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
      />

      <div className="flex items-center justify-between p-3 rounded-xl bg-bg-panel border border-bg-border mb-3">
        <div>
          <div className="text-sm font-semibold text-neutral-100">עדכון חובה</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {mandatory
              ? "משתמשים עם גרסה ישנה יותר ייחסמו ולא יוכלו להמשיך עד שיעדכנו."
              : "משתמשים עם גרסה ישנה יותר יקבלו הודעה עדינה שאפשר לדחות, ויוכלו להמשיך."}
          </div>
        </div>
        <button
          onClick={() => setMandatory((m) => !m)}
          className={`shrink-0 w-12 h-7 rounded-full relative transition ms-3 ${mandatory ? "bg-brand" : "bg-neutral-600"}`}
        >
          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${mandatory ? "right-0.5" : "right-[22px]"}`} />
        </button>
      </div>

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

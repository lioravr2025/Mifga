import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { Card } from "./Card";

/** Wipes every rider profile via admin_reset_all_profiles() (see schema_admin.sql) - a two-step confirm since it's irreversible. */
export default function DangerZonePanel({ onDone }: { onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("admin_reset_all_profiles");
    setRunning(false);
    setConfirming(false);
    if (err) {
      setError(err.message);
      return;
    }
    setResult(`נמחקו ${data} חשבונות.`);
    onDone();
  };

  return (
    <Card title="אזור מסוכן" icon={<AlertTriangle size={16} className="text-red-400" />}>
      <p className="text-[11px] text-neutral-500 mb-3 leading-relaxed">
        מוחק את כל חשבונות הרוכבים (לא כולל את חשבון הניהול הזה) וכל מה שתלוי בהם - נקודות, דיווחים, נסיעות, חברויות והודעות.
        דיווחי מפגעים עצמם נשארים, רק מאבדים את שיוך המדווח. הפעולה בלתי הפיכה.
      </p>
      {result && <div className="mb-3 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-xs text-green-300">{result}</div>}
      {error && <div className="mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-300">{error}</div>}
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-sm font-semibold active:scale-95 transition"
        >
          <Trash2 size={14} />
          מחיקת כל חשבונות הרוכבים
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={run}
            disabled={running}
            className="px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold active:scale-95 transition disabled:opacity-40"
          >
            {running ? "מוחק..." : "כן, אני בטוח - מחיקה"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={running}
            className="px-4 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-neutral-300 text-sm font-semibold active:scale-95 transition"
          >
            ביטול
          </button>
        </div>
      )}
    </Card>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ListChecks, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { WaitlistSignupRow } from "../lib/types";
import { Card } from "./Card";

export default function WaitlistPanel() {
  const [rows, setRows] = useState<WaitlistSignupRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    supabase
      .from("waitlist_signups")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data as WaitlistSignupRow[]) ?? []);
        setLoading(false);
      });
  };

  useEffect(load, []);

  // The whole point of this list: which city should we open next - so the
  // aggregate view is the headline, the raw rows are just the detail behind it.
  const byCity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.city, (counts.get(r.city) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const remove = async (id: string) => {
    await supabase.from("waitlist_signups").delete().eq("id", id);
    load();
  };

  return (
    <Card title={`רשימת המתנה - ערים (${rows.length} נרשמים)`} icon={<ListChecks size={16} className="text-brand-light" />}>
      {loading ? (
        <p className="text-xs text-neutral-500 text-center py-4">טוען...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-neutral-500 text-center py-4">אין עדיין נרשמים.</p>
      ) : (
        <>
          <div className="mb-4">
            <div className="text-[11px] text-neutral-500 mb-2">לפי עיר - איפה כדאי לפתוח הבא</div>
            <div className="space-y-1.5">
              {byCity.map(([city, count]) => {
                const pct = Math.round((count / rows.length) * 100);
                return (
                  <div key={city} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 truncate text-neutral-200 font-semibold">{city}</span>
                    <div className="flex-1 h-2 rounded-full bg-bg-border overflow-hidden">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 shrink-0 text-left text-neutral-400 tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-neutral-500 mb-1.5">נרשמים אחרונים</div>
          <div className="space-y-1 max-h-56 overflow-y-auto no-scrollbar">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-panel border border-bg-border text-xs">
                <div className="min-w-0">
                  <span className="text-neutral-100 font-semibold">{r.city}</span>
                  <span className="text-neutral-500 ms-2" dir="ltr">
                    {r.phone}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-neutral-500">{new Date(r.created_at).toLocaleDateString("he-IL")}</span>
                  <button onClick={() => remove(r.id)} className="text-neutral-500 active:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

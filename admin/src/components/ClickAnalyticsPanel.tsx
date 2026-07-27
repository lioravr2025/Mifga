import { useEffect, useState } from "react";
import { MousePointerClick } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { Card } from "./Card";

export default function ClickAnalyticsPanel() {
  const [counts, setCounts] = useState<{ element: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("ui_click_events")
      .select("element")
      .then(({ data }) => {
        const tally: Record<string, number> = {};
        for (const row of data ?? []) tally[row.element] = (tally[row.element] ?? 0) + 1;
        setCounts(
          Object.entries(tally)
            .map(([element, count]) => ({ element, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15)
        );
        setLoading(false);
      });
  }, []);

  const max = counts[0]?.count ?? 1;

  return (
    <Card title="הכפתורים הכי פופולריים" icon={<MousePointerClick size={16} className="text-brand-light" />}>
      {loading ? (
        <p className="text-xs text-neutral-500 text-center py-4">טוען...</p>
      ) : counts.length === 0 ? (
        <p className="text-xs text-neutral-500 text-center py-4">עדיין אין נתוני שימוש</p>
      ) : (
        <div className="space-y-2">
          {counts.map((c) => (
            <div key={c.element} className="text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-neutral-300">{c.element}</span>
                <span className="text-neutral-500 tabular-nums">{c.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-panel overflow-hidden">
                <div className="h-full bg-brand rounded-full" style={{ width: `${(c.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

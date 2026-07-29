import { useState } from "react";
import { AlertTriangle, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { HAZARD_TYPE_LABELS } from "../lib/hazardTypes";
import type { HazardRow } from "../lib/types";
import { Card } from "./Card";

export default function HazardsPanel({ hazards, onChanged }: { hazards: HazardRow[]; onChanged?: () => void }) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const sorted = [...hazards].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 25);
  const byType = hazards.reduce<Record<string, number>>((acc, h) => {
    acc[h.type] = (acc[h.type] ?? 0) + 1;
    return acc;
  }, {});

  const remove = async (id: string) => {
    setRemovingId(id);
    const { error } = await supabase.rpc("admin_remove_hazard", { p_hazard_id: id });
    setRemovingId(null);
    if (!error) onChanged?.();
  };

  return (
    <Card title={`דיווחי מפגעים (${hazards.length})`} icon={<AlertTriangle size={16} className="text-amber-400" />}>
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(byType)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => (
            <span key={type} className="px-2.5 py-1 rounded-full bg-bg-panel border border-bg-border text-[11px] text-neutral-300">
              {HAZARD_TYPE_LABELS[type] ?? type}: {count}
            </span>
          ))}
      </div>
      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {sorted.map((h) => (
          <div key={h.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-xs">
            <span className="flex-1 text-neutral-200 truncate">
              {HAZARD_TYPE_LABELS[h.type] ?? h.type} · {h.reporter_name}
            </span>
            <span className="flex items-center gap-1 text-green-400 shrink-0">
              <ThumbsUp size={11} />
              {h.confirmations}
            </span>
            <span className="flex items-center gap-1 text-red-400 shrink-0">
              <ThumbsDown size={11} />
              {h.denials}
            </span>
            <span className="text-neutral-500 shrink-0">{new Date(h.created_at).toLocaleDateString("he-IL")}</span>
            <button
              onClick={() => remove(h.id)}
              disabled={removingId === h.id}
              className="shrink-0 w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center active:scale-95 transition disabled:opacity-40"
              title="הסרת מפגע"
            >
              <X size={11} className="text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

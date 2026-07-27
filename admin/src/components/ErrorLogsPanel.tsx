import { useEffect, useState } from "react";
import { Bug } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { ClientErrorRow } from "../lib/types";
import { Card } from "./Card";

export default function ErrorLogsPanel() {
  const [errors, setErrors] = useState<ClientErrorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("client_error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setErrors((data as ClientErrorRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <Card title={`שגיאות אחרונות (${errors.length})`} icon={<Bug size={16} className="text-red-400" />}>
      {loading ? (
        <p className="text-xs text-neutral-500 text-center py-4">טוען...</p>
      ) : errors.length === 0 ? (
        <p className="text-xs text-neutral-500 text-center py-4">אין שגיאות מתועדות - מצוין</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {errors.map((e) => (
            <div key={e.id} className="px-3 py-2 rounded-xl bg-bg-panel border border-red-500/20 text-xs">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-red-300 font-semibold truncate">{e.message}</span>
                <span className="text-[10px] text-neutral-500 shrink-0 ms-2">{new Date(e.created_at).toLocaleString("he-IL")}</span>
              </div>
              <div className="text-[10px] text-neutral-500">{e.app_version ? `v${e.app_version}` : ""}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

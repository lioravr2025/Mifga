import { useEffect, useState } from "react";
import { Check, LifeBuoy } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { SupportTicketRow } from "../lib/types";
import { Card } from "./Card";

export default function SupportTicketsPanel() {
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTickets((data as SupportTicketRow[]) ?? []);
        setLoading(false);
      });
  };

  useEffect(load, []);

  const resolve = async (id: string) => {
    await supabase.from("support_tickets").update({ resolved: true }).eq("id", id);
    load();
  };

  const openCount = tickets.filter((t) => !t.resolved).length;

  return (
    <Card title={`פניות תמיכה (${openCount} פתוחות)`} icon={<LifeBuoy size={16} className="text-brand-light" />}>
      {loading ? (
        <p className="text-xs text-neutral-500 text-center py-4">טוען...</p>
      ) : tickets.length === 0 ? (
        <p className="text-xs text-neutral-500 text-center py-4">אין פניות</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {tickets.map((t) => (
            <div
              key={t.id}
              className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs ${
                t.resolved ? "bg-bg-panel border-bg-border opacity-50" : "bg-bg-panel border-amber-500/30"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-neutral-200 mb-0.5">{t.message}</div>
                <div className="text-[10px] text-neutral-500" dir="ltr">
                  {t.phone ?? "—"} · {new Date(t.created_at).toLocaleString("he-IL")}
                </div>
              </div>
              {!t.resolved && (
                <button
                  onClick={() => resolve(t.id)}
                  className="shrink-0 w-7 h-7 rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center active:scale-95 transition"
                  title="סימון כטופל"
                >
                  <Check size={13} className="text-green-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

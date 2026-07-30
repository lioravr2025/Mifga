import { useEffect, useState } from "react";
import { Megaphone, Send, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { BroadcastRow } from "../lib/types";
import { Card } from "./Card";

export default function BroadcastPanel({ totalRiders }: { totalRiders: number }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});

  const load = () => {
    supabase
      .from("broadcast_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        const rows = (data as BroadcastRow[]) ?? [];
        setBroadcasts(rows);
        if (rows.length === 0) return;
        supabase
          .from("broadcast_reads")
          .select("broadcast_id")
          .in(
            "broadcast_id",
            rows.map((b) => b.id)
          )
          .then(({ data: reads }) => {
            const tally: Record<string, number> = {};
            for (const r of (reads as { broadcast_id: string }[]) ?? []) tally[r.broadcast_id] = (tally[r.broadcast_id] ?? 0) + 1;
            setReadCounts(tally);
          });
      });
  };

  useEffect(load, []);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    const { data: session } = await supabase.auth.getUser();
    await supabase.from("broadcast_messages").insert({ message: message.trim(), created_by: session.user?.id });
    setMessage("");
    setSending(false);
    load();
  };

  const deactivate = async (id: string) => {
    await supabase.from("broadcast_messages").update({ active: false }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("broadcast_messages").delete().eq("id", id);
    load();
  };

  return (
    <Card title="הודעה לכל המשתמשים" icon={<Megaphone size={16} className="text-brand-light" />}>
      <div className="flex items-center gap-2 mb-3">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="הקלידו הודעה שתופיע כפופ-אפ לכל המשתמשים..."
          className="flex-1 px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-brand"
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={send}
          disabled={!message.trim() || sending}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold disabled:opacity-40 active:scale-95 transition flex items-center gap-1.5"
        >
          <Send size={14} />
          שליחה
        </button>
      </div>

      {broadcasts.length > 0 && (
        <div className="space-y-1.5">
          {broadcasts.map((b) => (
            <div
              key={b.id}
              className={`px-3 py-2 rounded-xl border text-xs ${
                b.active ? "bg-brand/10 border-brand/30" : "bg-bg-panel border-bg-border opacity-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 text-neutral-200">{b.message}</span>
                <span className="text-[10px] text-neutral-500 shrink-0">{new Date(b.created_at).toLocaleDateString("he-IL")}</span>
                {b.active && (
                  <button onClick={() => deactivate(b.id)} className="shrink-0 text-neutral-400" title="הפסקת הצגה למשתמשים">
                    <X size={13} />
                  </button>
                )}
                <button onClick={() => remove(b.id)} className="shrink-0 text-red-400" title="מחיקה מהרשימה">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1">
                נקראה על ידי <span className="text-neutral-300 font-semibold">{readCounts[b.id] ?? 0}</span> מתוך {totalRiders} רוכבים רשומים
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

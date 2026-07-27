import { useEffect, useState } from "react";
import { Megaphone, Send, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { BroadcastRow } from "../lib/types";
import { Card } from "./Card";

export default function BroadcastPanel() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);

  const load = () => {
    supabase
      .from("broadcast_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setBroadcasts((data as BroadcastRow[]) ?? []));
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
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                b.active ? "bg-brand/10 border-brand/30" : "bg-bg-panel border-bg-border opacity-50"
              }`}
            >
              <span className="flex-1 text-neutral-200">{b.message}</span>
              <span className="text-[10px] text-neutral-500 shrink-0">{new Date(b.created_at).toLocaleDateString("he-IL")}</span>
              {b.active && (
                <button onClick={() => deactivate(b.id)} className="shrink-0 text-neutral-400" title="ביטול">
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

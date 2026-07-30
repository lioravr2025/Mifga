import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { isBackendConfigured, supabase } from "../lib/supabaseClient";
import { loadJSON, saveJSON } from "../lib/storage";
import { useApp } from "../context/AppContext";

interface Broadcast {
  id: string;
  message: string;
}

/** Admin -> all-users popup announcement (sent from the admin dashboard's BroadcastPanel). Persists dismissal per broadcast id so it doesn't reappear once closed. */
export default function BroadcastPopup() {
  const { user } = useApp();
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);

  useEffect(() => {
    if (!isBackendConfigured || !supabase) return;
    const checkLatest = () => {
      supabase!
        .from("broadcast_messages")
        .select("id, message")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          const dismissed = loadJSON<string[]>("dismissedBroadcasts", []);
          if (!dismissed.includes(data.id)) setBroadcast(data);
        });
    };
    checkLatest();
    const channel = supabase
      .channel("broadcast-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "broadcast_messages" }, () => checkLatest())
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, []);

  if (!broadcast) return null;

  const dismiss = () => {
    const dismissed = loadJSON<string[]>("dismissedBroadcasts", []);
    saveJSON("dismissedBroadcasts", [...dismissed, broadcast.id].slice(-50));
    if (isBackendConfigured && supabase && user.id) {
      supabase
        .from("broadcast_reads")
        .insert({ broadcast_id: broadcast.id, user_id: user.id })
        .then(() => {}); // best-effort - dismissal already persisted locally either way
    }
    setBroadcast(null);
  };

  return (
    <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div className="w-full max-w-xs bg-bg-panel border border-brand/40 rounded-3xl p-5 shadow-2xl animate-popIn">
        <div className="flex items-center justify-between mb-3">
          <span className="w-10 h-10 rounded-full bg-brand/15 flex items-center justify-center">
            <Megaphone size={18} className="text-brand-light" />
          </span>
          <button onClick={dismiss} className="text-neutral-400">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-neutral-100 leading-relaxed mb-4">{broadcast.message}</p>
        <button onClick={dismiss} className="w-full py-2.5 rounded-2xl bg-brand text-white font-bold text-sm active:scale-95 transition">
          הבנתי
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Check, Search, UserPlus, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { useApp } from "../context/AppContext";
import type { ProfileSearchResult } from "../lib/backend/friends";

export default function AddFriendSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { searchFriendCandidates, addFriendByUid } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  const close = () => {
    setQuery("");
    setResults([]);
    setSentTo(new Set());
    onClose();
  };

  const runSearch = async (value: string) => {
    setQuery(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const found = await searchFriendCandidates(trimmed);
      setResults(found);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const send = async (targetUid: string) => {
    setSentTo((prev) => new Set(prev).add(targetUid));
    try {
      await addFriendByUid(targetUid);
    } catch {
      setSentTo((prev) => {
        const next = new Set(prev);
        next.delete(targetUid);
        return next;
      });
    }
  };

  return (
    <BottomSheet open={open} onClose={close} maxHeight="80%">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-neutral-50">הוספת חבר</h2>
        <button onClick={close} className="text-neutral-400">
          <X size={22} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bg-panel2 border border-bg-border mb-4">
        <Search size={15} className="text-neutral-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="חיפוש לפי שם משתמש"
          dir="ltr"
          className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500 text-right"
          autoFocus
        />
      </div>

      {searching && <div className="text-center text-xs text-neutral-500 py-4">מחפש...</div>}

      {!searching && query.trim() && results.length === 0 && (
        <div className="text-center text-xs text-neutral-500 py-4">לא נמצא משתמש בשם "{query.trim()}"</div>
      )}

      <div className="space-y-2">
        {results.map((r) => {
          const sent = sentTo.has(r.id);
          return (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-2xl bg-bg-panel2 border border-bg-border">
              <span className="w-9 h-9 rounded-full bg-bg-panel border border-bg-border flex items-center justify-center text-lg shrink-0">
                {r.avatarEmoji}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-neutral-100">{r.name}</div>
                <div className="text-[11px] text-neutral-500" dir="ltr">
                  @{r.username} · {r.points} נק'
                </div>
              </div>
              <button
                onClick={() => !sent && send(r.id)}
                disabled={sent}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold active:scale-95 transition ${
                  sent ? "bg-green-500/15 text-green-400 border border-green-500/40" : "bg-brand/15 text-brand-light border border-brand/50"
                }`}
              >
                {sent ? <Check size={13} /> : <UserPlus size={13} />}
                {sent ? "נשלחה בקשה" : "הוספה"}
              </button>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}

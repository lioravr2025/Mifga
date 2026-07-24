import { useState } from "react";
import { Check, Search, Users, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { useApp } from "../context/AppContext";
import type { Friend } from "../types";

export default function CreateGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { friends, createGroup } = useApp();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (f: Friend) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(f.id)) next.delete(f.id);
      else next.add(f.id);
      return next;
    });
  };

  const filtered = friends.filter((f) => f.name.includes(query.trim()));

  const submit = () => {
    if (!name.trim() || selected.size === 0) return;
    createGroup(name.trim(), Array.from(selected));
    setName("");
    setQuery("");
    setSelected(new Set());
    onClose();
  };

  const close = () => {
    setName("");
    setQuery("");
    setSelected(new Set());
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={close} maxHeight="85%">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-neutral-50">קבוצת ווקי-טוקי חדשה</h2>
        <button onClick={close} className="text-neutral-400">
          <X size={22} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border mb-3">
        <Users size={16} className="text-brand-light shrink-0" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם הקבוצה (למשל: החברים מהכיתה)"
          className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
        />
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bg-panel2 border border-bg-border mb-3">
        <Search size={15} className="text-neutral-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש חבר להוספה"
          className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
        />
      </div>

      <div className="space-y-2 mb-4">
        {filtered.map((f) => {
          const checked = selected.has(f.id);
          return (
            <button
              key={f.id}
              onClick={() => toggle(f)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border active:scale-[0.98] transition ${
                checked ? "bg-brand/15 border-brand/50" : "bg-bg-panel2 border-bg-border"
              }`}
            >
              <span className="w-9 h-9 rounded-full bg-bg-panel border border-bg-border flex items-center justify-center text-lg">
                {f.avatarEmoji}
              </span>
              <span className="flex-1 text-right text-sm font-medium text-neutral-100">{f.name}</span>
              <span
                className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                  checked ? "bg-brand border-brand" : "border-neutral-600"
                }`}
              >
                {checked && <Check size={13} className="text-white" />}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && <div className="text-center text-xs text-neutral-500 py-4">לא נמצאו חברים</div>}
      </div>

      <p className="text-[11px] text-neutral-500 mb-3 text-center">
        כל חבר שתבחרו יקבל בקשת הצטרפות לקבוצה, ויתווסף לאחר שיאשר.
      </p>

      <button
        onClick={submit}
        disabled={!name.trim() || selected.size === 0}
        className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-40 active:scale-95 transition"
      >
        יצירת קבוצה {selected.size > 0 ? `(${selected.size})` : ""}
      </button>
    </BottomSheet>
  );
}

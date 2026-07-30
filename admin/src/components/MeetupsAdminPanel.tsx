import { useEffect, useMemo, useState } from "react";
import { Calendar, Eye, MapPin, Pencil, Search, Trash2, Users, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { MeetupRow, ProfileRow } from "../lib/types";
import { Card, StatCard } from "./Card";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MeetupsAdminPanel() {
  const [meetups, setMeetups] = useState<MeetupRow[]>([]);
  const [hostNames, setHostNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MeetupRow | null>(null);

  const load = () => {
    setLoading(true);
    supabase
      .from("meetups")
      .select("*")
      .order("starts_at", { ascending: false })
      .then(async ({ data }) => {
        const rows = (data as MeetupRow[]) ?? [];
        setMeetups(rows);
        const hostIds = [...new Set(rows.map((m) => m.host_id))];
        if (hostIds.length > 0) {
          const { data: hosts } = await supabase.from("profiles").select("id, name").in("id", hostIds);
          setHostNames(Object.fromEntries(((hosts as Pick<ProfileRow, "id" | "name">[]) ?? []).map((h) => [h.id, h.name])));
        }
        setLoading(false);
      });
  };

  useEffect(load, []);

  const now = Date.now();
  const stats = useMemo(() => {
    let active = 0,
      expired = 0,
      removed = 0;
    for (const m of meetups) {
      if (m.removed) removed++;
      else if (new Date(m.ends_at ?? m.starts_at).getTime() < now) expired++;
      else active++;
    }
    return { active, expired, removed, total: meetups.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetups]);

  const filtered = meetups.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      m.title.toLowerCase().includes(q) ||
      m.location_text.toLowerCase().includes(q) ||
      (hostNames[m.host_id] ?? "").toLowerCase().includes(q)
    );
  });

  const remove = async (id: string) => {
    await supabase.rpc("admin_remove_meetup", { p_meetup_id: id });
    load();
  };

  const saveEdit = async (row: MeetupRow) => {
    await supabase.from("meetups").update({ title: row.title, description: row.description, location_text: row.location_text }).eq("id", row.id);
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="סה״כ מפגשים" value={stats.total} icon={<Calendar size={17} className="text-brand-light" />} />
        <StatCard label="פעילים" value={stats.active} icon={<Calendar size={17} className="text-green-400" />} accent="#22c55e" />
        <StatCard label="פג תוקף" value={stats.expired} icon={<Calendar size={17} className="text-neutral-400" />} accent="#64748b" />
        <StatCard label="הוסרו" value={stats.removed} icon={<Trash2 size={17} className="text-red-400" />} accent="#ef4444" />
      </div>

      <Card title={`מפגשים (${filtered.length})`} icon={<Calendar size={16} className="text-brand-light" />}>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border mb-3">
          <Search size={14} className="text-neutral-500 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם, מיקום או מארח..."
            className="flex-1 bg-transparent outline-none text-xs text-neutral-100 placeholder:text-neutral-500"
          />
        </div>

        {loading ? (
          <p className="text-xs text-neutral-500 text-center py-4">טוען...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-4">אין מפגשים</p>
        ) : (
          <div className="space-y-1.5 max-h-[560px] overflow-y-auto">
            {filtered.map((m) => {
              const expired = !m.removed && new Date(m.ends_at ?? m.starts_at).getTime() < now;
              return (
                <div key={m.id} className="px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-xs">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="text-neutral-100 font-semibold truncate">{m.title}</div>
                      <div className="text-neutral-500">מארח: {hostNames[m.host_id] ?? m.host_id.slice(0, 8)}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {m.removed && <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-semibold">הוסר</span>}
                      {expired && <span className="px-2 py-0.5 rounded-full bg-bg-panel2 text-neutral-400 text-[10px] font-semibold">פג תוקף</span>}
                      <button onClick={() => setEditing(m)} className="w-6 h-6 rounded-full bg-bg-panel2 border border-bg-border flex items-center justify-center">
                        <Pencil size={10} className="text-neutral-400" />
                      </button>
                      {!m.removed && (
                        <button
                          onClick={() => remove(m.id)}
                          className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center"
                        >
                          <Trash2 size={10} className="text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-neutral-500 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {fmtDateTime(m.starts_at)}
                    </span>
                    <span className="flex items-center gap-1 truncate">
                      <MapPin size={10} />
                      {m.location_text}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye size={10} />
                      {m.views}
                    </span>
                    {m.privacy === "private" && <span className="text-amber-400">פרטי</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-sm bg-bg-panel2 border border-bg-border rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-neutral-50">עריכת מפגש</span>
              <button onClick={() => setEditing(null)} className="text-neutral-400">
                <X size={18} />
              </button>
            </div>
            <label className="text-xs text-neutral-400 mb-1 block">שם</label>
            <input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="w-full mb-3 px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
            />
            <label className="text-xs text-neutral-400 mb-1 block">מיקום</label>
            <input
              value={editing.location_text}
              onChange={(e) => setEditing({ ...editing, location_text: e.target.value })}
              className="w-full mb-3 px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
            />
            <label className="text-xs text-neutral-400 mb-1 block">תיאור</label>
            <textarea
              value={editing.description ?? ""}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              rows={3}
              className="w-full mb-4 px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand resize-none"
            />
            <button
              onClick={() => saveEdit(editing)}
              className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-bold active:scale-95 transition"
            >
              שמירה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

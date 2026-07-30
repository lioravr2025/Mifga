import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Search, TrendingUp, User, X } from "lucide-react";
import type { ProfileRow, RideLogRow } from "../lib/types";
import { Card } from "./Card";

const VEHICLE_LABELS: Record<string, string> = { scooter: "קורקינט", ebike: "אופניים חשמליים", emotorcycle: "אופנוע חשמלי" };
const PLATFORM_LABELS: Record<string, string> = { android: "אנדרואיד", ios: "iOS", web: "דפדפן" };

type SortKey = "newest" | "oldest" | "points" | "rides" | "recent" | "name";

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("he-IL", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function RidersPanel({ profiles, rides }: { profiles: ProfileRow[]; rides: RideLogRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<ProfileRow | null>(null);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const rideCountFor = (uid: string) => rides.filter((r) => r.user_id === uid).length;

  const dailySignups = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of profiles) {
      const key = dateKey(p.created_at);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const days: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key.slice(5), count: counts[key] ?? 0 });
    }
    return days;
  }, [profiles]);

  const todayCount = profiles.filter((p) => dateKey(p.created_at) === new Date().toISOString().slice(0, 10)).length;
  const yesterdayKey = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const yesterdayCount = profiles.filter((p) => dateKey(p.created_at) === yesterdayKey).length;

  const rangeCount = useMemo(() => {
    if (!rangeFrom || !rangeTo) return null;
    const from = new Date(rangeFrom).getTime();
    const to = new Date(rangeTo).getTime() + 86_400_000; // inclusive of the "to" day
    return profiles.filter((p) => {
      const t = new Date(p.created_at).getTime();
      return t >= from && t < to;
    }).length;
  }, [profiles, rangeFrom, rangeTo]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = profiles;
    if (q) {
      list = list.filter(
        (p) => p.name?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q) || p.phone?.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    switch (sort) {
      case "newest":
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "oldest":
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "points":
        sorted.sort((a, b) => b.points - a.points);
        break;
      case "rides":
        sorted.sort((a, b) => rideCountFor(b.id) - rideCountFor(a.id));
        break;
      case "recent":
        sorted.sort((a, b) => new Date(b.last_active_at ?? 0).getTime() - new Date(a.last_active_at ?? 0).getTime());
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "he"));
        break;
    }
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, rides, query, sort]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="הרשמות יומיות (30 יום אחרונים)" icon={<TrendingUp size={16} className="text-brand-light" />}>
          <div className="flex gap-4 mb-3 text-xs">
            <div>
              <div className="text-lg font-extrabold text-neutral-50 tabular-nums">{todayCount}</div>
              <div className="text-neutral-500">היום</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-neutral-50 tabular-nums">{yesterdayCount}</div>
              <div className="text-neutral-500">אתמול</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-neutral-50 tabular-nums">{profiles.length}</div>
              <div className="text-neutral-500">סה"כ</div>
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySignups}>
                <CartesianGrid strokeDasharray="3 3" stroke="#243250" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={4} />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#131c2e", border: "1px solid #243250", fontSize: 12 }} labelStyle={{ color: "#e2e8f0" }} />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="הרשמות בין תאריכים" icon={<TrendingUp size={16} className="text-brand-light" />}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">מתאריך</label>
              <input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-xs text-neutral-100 outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">עד תאריך</label>
              <input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-xs text-neutral-100 outline-none focus:border-brand"
              />
            </div>
          </div>
          {rangeCount !== null ? (
            <div className="text-center py-4">
              <div className="text-3xl font-extrabold text-brand-light tabular-nums">{rangeCount}</div>
              <div className="text-xs text-neutral-500 mt-1">נרשמו בטווח שנבחר</div>
            </div>
          ) : (
            <p className="text-xs text-neutral-500 text-center py-8">בחרו טווח תאריכים כדי לראות כמה נרשמו</p>
          )}
        </Card>
      </div>

      <Card title={`רוכבים (${filtered.length}/${profiles.length})`} icon={<User size={16} className="text-brand-light" />}>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-panel border border-bg-border">
            <Search size={14} className="text-neutral-500 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם, שם משתמש או טלפון..."
              className="flex-1 bg-transparent outline-none text-xs text-neutral-100 placeholder:text-neutral-500"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-xs text-neutral-100 outline-none focus:border-brand"
          >
            <option value="newest">חדשים ביותר</option>
            <option value="oldest">ותיקים ביותר</option>
            <option value="points">הכי הרבה נקודות</option>
            <option value="rides">הכי הרבה נסיעות</option>
            <option value="recent">פעילים לאחרונה</option>
            <option value="name">שם (א-ת)</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-6">לא נמצאו רוכבים</p>
        ) : (
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-right active:scale-[0.99] transition"
              >
                <span className="w-9 h-9 rounded-full bg-bg-panel2 border border-bg-border flex items-center justify-center shrink-0 overflow-hidden text-base">
                  {p.avatar_photo_url ? <img src={p.avatar_photo_url} alt="" className="w-full h-full object-cover" /> : p.avatar_emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-100 truncate">{p.name}</div>
                  <div className="text-[10px] text-neutral-500 truncate" dir="ltr">
                    @{p.username}
                  </div>
                </div>
                <div className="text-[10px] text-neutral-500 shrink-0 text-left">
                  <div>{rideCountFor(p.id)} נסיעות</div>
                  <div>{p.points} נק'</div>
                </div>
                <div className="text-[10px] text-neutral-600 shrink-0 w-20 text-left">{fmtDate(p.created_at).split(",")[0]}</div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-sm bg-bg-panel2 border border-bg-border rounded-2xl p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-full bg-bg-panel border border-bg-border flex items-center justify-center overflow-hidden text-xl">
                  {selected.avatar_photo_url ? (
                    <img src={selected.avatar_photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    selected.avatar_emoji
                  )}
                </span>
                <div>
                  <div className="text-base font-bold text-neutral-50">{selected.name}</div>
                  <div className="text-xs text-neutral-500" dir="ltr">
                    @{selected.username}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-400">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                ["טלפון", selected.phone ?? "-"],
                ["מכשיר", selected.platform ? (PLATFORM_LABELS[selected.platform] ?? selected.platform) : "לא ידוע"],
                ["כלי", selected.vehicle_type ? (VEHICLE_LABELS[selected.vehicle_type] ?? selected.vehicle_type) : "-"],
                ["דגם כלי", selected.vehicle_model ?? "-"],
                ["תאריך הרשמה", fmtDate(selected.created_at)],
                ["שימוש אחרון", fmtDate(selected.last_active_at)],
                ["מספר נסיעות", String(rideCountFor(selected.id))],
                ["נקודות", String(selected.points)],
                ["דיווחי מפגעים", String(selected.reports_count)],
                ["מתוכם עם תמונה", String(selected.reports_with_photo)],
                ["סטטוס", selected.riding_since ? "בנסיעה כרגע" : "לא בנסיעה"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-panel border border-bg-border">
                  <span className="text-neutral-400">{label}</span>
                  <span className="text-neutral-100 font-medium" dir="ltr">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

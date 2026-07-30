import { useEffect, useMemo, useState } from "react";
import { Eye, MapPin, Pencil, RotateCcw, Search, ShoppingBag, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { MarketplaceListingRow, ProfileRow } from "../lib/types";
import { Card, StatCard } from "./Card";

function fmtPrice(price: number | null): string {
  if (price == null) return "לפי שיחה";
  return `${price.toLocaleString("he-IL")} ₪`;
}

export default function MarketplaceAdminPanel() {
  const [listings, setListings] = useState<MarketplaceListingRow[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MarketplaceListingRow | null>(null);

  const load = () => {
    setLoading(true);
    supabase
      .from("marketplace_listings")
      .select("*")
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const rows = (data as MarketplaceListingRow[]) ?? [];
        setListings(rows);
        const sellerIds = [...new Set(rows.map((l) => l.seller_id))];
        if (sellerIds.length > 0) {
          const { data: sellers } = await supabase.from("profiles").select("id, name").in("id", sellerIds);
          setSellerNames(Object.fromEntries(((sellers as Pick<ProfileRow, "id" | "name">[]) ?? []).map((s) => [s.id, s.name])));
        }
        setLoading(false);
      });
  };

  useEffect(load, []);

  const stats = useMemo(() => {
    const active = listings.filter((l) => l.active).length;
    const removed = listings.filter((l) => !l.active).length;
    const totalViews = listings.reduce((sum, l) => sum + (l.views ?? 0), 0);
    return { active, removed, total: listings.length, totalViews };
  }, [listings]);

  const filtered = listings.filter((l) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      l.title.toLowerCase().includes(q) ||
      (l.location_text ?? "").toLowerCase().includes(q) ||
      (sellerNames[l.seller_id] ?? "").toLowerCase().includes(q)
    );
  });

  const setActive = async (id: string, active: boolean) => {
    await supabase.from("marketplace_listings").update({ active }).eq("id", id);
    load();
  };

  const saveEdit = async (row: MarketplaceListingRow) => {
    await supabase
      .from("marketplace_listings")
      .update({ title: row.title, description: row.description, price: row.price, location_text: row.location_text })
      .eq("id", row.id);
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="סה״כ מודעות" value={stats.total} icon={<ShoppingBag size={17} className="text-brand-light" />} />
        <StatCard label="פעילות" value={stats.active} icon={<ShoppingBag size={17} className="text-green-400" />} accent="#22c55e" />
        <StatCard label="הוסרו" value={stats.removed} icon={<Trash2 size={17} className="text-red-400" />} accent="#ef4444" />
        <StatCard label="סה״כ צפיות" value={stats.totalViews} icon={<Eye size={17} className="text-sky-400" />} accent="#38bdf8" />
      </div>

      <Card title={`לוח מודעות (${filtered.length})`} icon={<ShoppingBag size={16} className="text-brand-light" />}>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border mb-3">
          <Search size={14} className="text-neutral-500 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם, מיקום או מפרסם..."
            className="flex-1 bg-transparent outline-none text-xs text-neutral-100 placeholder:text-neutral-500"
          />
        </div>

        {loading ? (
          <p className="text-xs text-neutral-500 text-center py-4">טוען...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-4">אין מודעות</p>
        ) : (
          <div className="space-y-1.5 max-h-[560px] overflow-y-auto">
            {filtered.map((l) => (
              <div key={l.id} className={`px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-xs ${!l.active ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="text-neutral-100 font-semibold truncate">{l.title}</div>
                    <div className="text-neutral-500">מפרסם: {sellerNames[l.seller_id] ?? l.seller_id.slice(0, 8)}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!l.active && <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-semibold">הוסר</span>}
                    <button onClick={() => setEditing(l)} className="w-6 h-6 rounded-full bg-bg-panel2 border border-bg-border flex items-center justify-center">
                      <Pencil size={10} className="text-neutral-400" />
                    </button>
                    {l.active ? (
                      <button
                        onClick={() => setActive(l.id, false)}
                        className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center"
                        title="הסרה"
                      >
                        <Trash2 size={10} className="text-red-400" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setActive(l.id, true)}
                        className="w-6 h-6 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center"
                        title="שחזור"
                      >
                        <RotateCcw size={10} className="text-green-400" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-neutral-500 text-[11px]">
                  <span className="text-brand-light font-semibold">{fmtPrice(l.price)}</span>
                  {l.location_text && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin size={10} />
                      {l.location_text}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Eye size={10} />
                    {l.views ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-sm bg-bg-panel2 border border-bg-border rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-neutral-50">עריכת מודעה</span>
              <button onClick={() => setEditing(null)} className="text-neutral-400">
                <X size={18} />
              </button>
            </div>
            <label className="text-xs text-neutral-400 mb-1 block">כותרת</label>
            <input
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="w-full mb-3 px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
            />
            <label className="text-xs text-neutral-400 mb-1 block">מחיר</label>
            <input
              type="number"
              value={editing.price ?? ""}
              onChange={(e) => setEditing({ ...editing, price: e.target.value ? Number(e.target.value) : null })}
              className="w-full mb-3 px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand"
            />
            <label className="text-xs text-neutral-400 mb-1 block">מיקום</label>
            <input
              value={editing.location_text ?? ""}
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

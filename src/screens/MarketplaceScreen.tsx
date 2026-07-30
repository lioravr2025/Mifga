import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Camera, Loader2, MapPin, Phone, Plus, Search, ShoppingBag, Trash2, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { isBackendConfigured } from "../lib/supabaseClient";
import { createListing, fetchListings, removeListing } from "../lib/backend/marketplace";
import { VEHICLE_DEFS } from "../components/VehicleIcons";
import type { MarketplaceListing, VehicleTypeId } from "../types";

const VEHICLE_LABELS: Record<string, string> = { scooter: "קורקינט", ebike: "אופניים חשמליים", emotorcycle: "אופנוע חשמלי", other: "אחר" };

function fmtPrice(price?: number): string {
  if (price == null) return "מחיר לפי שיחה";
  return `${price.toLocaleString("he-IL")} ₪`;
}

export default function MarketplaceScreen({ onClose }: { onClose: () => void }) {
  const { user } = useApp();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create">("list");
  const [query, setQuery] = useState("");

  const load = () => {
    if (!isBackendConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchListings()
      .then(setListings)
      .catch((err) => console.error("Mifga: fetchListings failed", err))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = listings.filter((l) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return l.title.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q) || l.locationText?.toLowerCase().includes(q);
  });

  const remove = async (id: string) => {
    try {
      await removeListing(id);
      load();
    } catch (err) {
      console.error("Mifga: removeListing failed", err);
    }
  };

  if (view === "create") {
    return (
      <CreateListingView
        onClose={() => setView("list")}
        onCreated={() => {
          setView("list");
          load();
        }}
      />
    );
  }

  return (
    <div className="absolute inset-0 z-[2500] bg-bg flex flex-col safe-top">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-bg-border">
        <button onClick={onClose} className="text-neutral-400">
          <ArrowRight size={22} />
        </button>
        <h1 className="text-lg font-bold text-neutral-50">מכירה וקנייה</h1>
        <button
          onClick={() => setView("create")}
          className="w-9 h-9 rounded-full bg-brand flex items-center justify-center active:scale-95 transition"
          title="פרסום מודעה"
        >
          <Plus size={18} className="text-white" />
        </button>
      </div>

      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-bg-panel2 border border-bg-border">
          <Search size={15} className="text-neutral-500 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש כלי, עיר או תיאור..."
            className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-neutral-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <ShoppingBag size={32} className="text-neutral-600 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">אין עדיין מודעות{query ? " שתואמות לחיפוש" : ""}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((l) => (
              <div key={l.id} className="rounded-2xl bg-bg-panel2 border border-bg-border overflow-hidden">
                <div className="w-full h-28 bg-bg-panel flex items-center justify-center">
                  {l.photoUrl ? (
                    <img src={l.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag size={22} className="text-neutral-600" />
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm font-bold text-neutral-50 truncate mb-0.5">{l.title}</div>
                  <div className="text-xs text-brand-light font-semibold mb-1.5">{fmtPrice(l.price)}</div>
                  {l.locationText && (
                    <div className="flex items-center gap-1 text-[10px] text-neutral-500 mb-2 truncate">
                      <MapPin size={10} className="shrink-0" />
                      {l.locationText}
                    </div>
                  )}
                  <a
                    href={`tel:${l.phone}`}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand/15 border border-brand/40 text-brand-light text-xs font-semibold active:scale-95 transition"
                  >
                    <Phone size={12} />
                    יצירת קשר
                  </a>
                  {l.sellerId === user.id && (
                    <button
                      onClick={() => remove(l.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 mt-1.5 rounded-xl text-red-400 text-[11px] font-semibold active:scale-95 transition"
                    >
                      <Trash2 size={11} />
                      הסרת המודעה
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateListingView({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useApp();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleTypeId | "other" | undefined>(undefined);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [locationText, setLocationText] = useState("");
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit = title.trim().length > 0 && phone.trim().length > 0;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!canSubmit || !user.id) return;
    setSubmitting(true);
    setError(null);
    try {
      await createListing({
        sellerId: user.id,
        title: title.trim(),
        description: description.trim() || undefined,
        price: price ? Number(price) : undefined,
        vehicleType,
        photoDataUrl: photo,
        phone: phone.trim(),
        locationText: locationText.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      console.error("Mifga: createListing failed", err);
      setError("פרסום המודעה נכשל - נסו שוב");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[2500] bg-bg flex flex-col safe-top">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-bg-border">
        <button onClick={onClose} className="text-neutral-400">
          <X size={22} />
        </button>
        <h1 className="text-lg font-bold text-neutral-50">מודעה חדשה</h1>
        <span className="w-9" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full h-32 rounded-2xl bg-bg-panel2 border border-dashed border-bg-border flex flex-col items-center justify-center gap-1.5 mb-5 overflow-hidden"
        >
          {photo ? (
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <>
              <Camera size={22} className="text-neutral-500" />
              <span className="text-xs text-neutral-500">תמונה</span>
            </>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <label className="text-xs text-neutral-400 mb-1.5 block">כותרת *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="למשל: קורקינט חשמלי שמור"
          className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4"
        />

        <label className="text-xs text-neutral-400 mb-1.5 block">סוג כלי</label>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[...VEHICLE_DEFS, { id: "other" as const, label: "אחר", Icon: ShoppingBag }].map(({ id, label, Icon }) => {
            const active = vehicleType === id;
            return (
              <button
                key={id}
                onClick={() => setVehicleType((prev) => (prev === id ? undefined : id))}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl border active:scale-95 transition ${
                  active ? "bg-brand/15 border-brand" : "bg-bg-panel2 border-bg-border"
                }`}
              >
                <Icon size={18} color={active ? "#a78bfa" : "#9ca3af"} />
                <span className={`text-[10px] font-semibold text-center leading-tight ${active ? "text-brand-light" : "text-neutral-300"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        <label className="text-xs text-neutral-400 mb-1.5 block">מחיר (רשות, ₪)</label>
        <input
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="ללא מחיר קבוע"
          className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4"
        />

        <label className="text-xs text-neutral-400 mb-1.5 block">עיר / מיקום (רשות)</label>
        <input
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4"
        />

        <label className="text-xs text-neutral-400 mb-1.5 block">טלפון ליצירת קשר *</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="050-1234567"
          dir="ltr"
          className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4"
        />

        <label className="text-xs text-neutral-400 mb-1.5 block">תיאור (רשות)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4 resize-none"
        />

        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs font-semibold mb-4">
            <AlertTriangle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-40 active:scale-95 transition flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          פרסום מודעה
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { isBackendConfigured } from "../lib/supabaseClient";
import { useGeolocation } from "../hooks/useGeolocation";
import AddressAutocomplete from "../components/AddressAutocomplete";
import { createListing, fetchListings, incrementListingViews, removeListing } from "../lib/backend/marketplace";
import { VEHICLE_DEFS } from "../components/VehicleIcons";
import type { LatLng, MarketplaceListing, VehicleTypeId } from "../types";

const VEHICLE_LABELS: Record<string, string> = { scooter: "קורקינט", ebike: "אופניים חשמליים", emotorcycle: "אופנוע חשמלי", other: "אחר" };
const MAX_PHOTOS = 5;

function fmtPrice(price?: number): string {
  if (price == null) return "מחיר לפי שיחה";
  return `${price.toLocaleString("he-IL")} ₪`;
}

/** wa.me needs digits only, with the country code and no leading 0 - "050-1234567" -> "972501234567". */
function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
}

export default function MarketplaceScreen({ onClose }: { onClose: () => void }) {
  const { user } = useApp();
  const { position } = useGeolocation();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create">("list");
  const [selected, setSelected] = useState<MarketplaceListing | null>(null);
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
      setSelected(null);
      load();
    } catch (err) {
      console.error("Mifga: removeListing failed", err);
    }
  };

  if (view === "create") {
    return (
      <CreateListingView
        biasNear={position}
        onClose={() => setView("list")}
        onCreated={() => {
          setView("list");
          load();
        }}
      />
    );
  }

  if (selected) {
    return <ListingDetailView listing={selected} isOwner={selected.sellerId === user.id} onBack={() => setSelected(null)} onRemove={remove} />;
  }

  return (
    <div className="absolute inset-0 z-[2500] bg-bg flex flex-col safe-top">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-bg-border">
        <button onClick={onClose} className="text-neutral-400">
          <ArrowRight size={22} />
        </button>
        <h1 className="text-lg font-bold text-neutral-50">מכירה וקנייה</h1>
        <span className="w-9" />
      </div>

      <div className="px-5 pt-4">
        <button
          onClick={() => setView("create")}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand text-white font-bold text-sm active:scale-95 transition mb-3"
        >
          <Plus size={18} />
          מודעה חדשה
        </button>
      </div>

      <div className="px-5 pb-2">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-bg-panel2 border border-bg-border mb-2">
          <Search size={15} className="text-neutral-500 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש כלי או תיאור..."
            className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
          />
        </div>
        <AddressAutocomplete biasNear={position} placeholder="או חיפוש לפי עיר..." onQueryChange={setQuery} onSelect={(s) => setQuery(s.label)} />
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
              <button
                key={l.id}
                onClick={() => setSelected(l)}
                className="text-right rounded-2xl bg-bg-panel2 border border-bg-border overflow-hidden active:scale-[0.98] transition"
              >
                <div className="w-full h-28 bg-bg-panel flex items-center justify-center">
                  {l.photoUrls[0] ? (
                    <img src={l.photoUrls[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag size={22} className="text-neutral-600" />
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm font-bold text-neutral-50 truncate mb-0.5">{l.title}</div>
                  <div className="text-xs text-brand-light font-semibold mb-1">{fmtPrice(l.price)}</div>
                  {l.locationText && (
                    <div className="flex items-center gap-1 text-[10px] text-neutral-500 truncate">
                      <MapPin size={10} className="shrink-0" />
                      {l.locationText}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ListingDetailView({
  listing,
  isOwner,
  onBack,
  onRemove,
}: {
  listing: MarketplaceListing;
  isOwner: boolean;
  onBack: () => void;
  onRemove: (id: string) => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    incrementListingViews(listing.id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);

  const whatsappUrl = `https://wa.me/${toWhatsAppNumber(listing.phone)}?text=${encodeURIComponent(`היי, ראיתי את המודעה "${listing.title}" ב-Mifga`)}`;

  return (
    <div className="absolute inset-0 z-[2500] bg-bg flex flex-col safe-top">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="relative">
          {listing.photoUrls.length > 0 ? (
            <img src={listing.photoUrls[photoIndex]} alt="" className="w-full h-64 object-cover" />
          ) : (
            <div className="w-full h-40 bg-bg-panel2 flex items-center justify-center">
              <ShoppingBag size={40} className="text-neutral-700" />
            </div>
          )}
          <button onClick={onBack} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-bg/70 backdrop-blur flex items-center justify-center">
            <ArrowRight size={18} className="text-white" />
          </button>
          {listing.photoUrls.length > 1 && (
            <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5">
              {listing.photoUrls.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPhotoIndex(i)}
                  className={`w-2 h-2 rounded-full transition ${i === photoIndex ? "bg-white" : "bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </div>

        {listing.photoUrls.length > 1 && (
          <div className="flex gap-2 px-5 pt-3 overflow-x-auto no-scrollbar">
            {listing.photoUrls.map((url, i) => (
              <button
                key={i}
                onClick={() => setPhotoIndex(i)}
                className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 ${i === photoIndex ? "border-brand" : "border-transparent"}`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="px-5 py-5">
          <h1 className="text-xl font-bold text-neutral-50 mb-1">{listing.title}</h1>
          <div className="text-lg font-extrabold text-brand-light mb-3">{fmtPrice(listing.price)}</div>

          <div className="flex items-center gap-2 flex-wrap mb-4">
            {listing.vehicleType && (
              <span className="px-2.5 py-1 rounded-full bg-bg-panel2 border border-bg-border text-[11px] text-neutral-300">
                {VEHICLE_LABELS[listing.vehicleType] ?? listing.vehicleType}
              </span>
            )}
            {listing.locationText && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-bg-panel2 border border-bg-border text-[11px] text-neutral-300">
                <MapPin size={11} />
                {listing.locationText}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 mb-4 text-xs text-neutral-500">
            <span className="w-7 h-7 rounded-full bg-bg-panel2 flex items-center justify-center overflow-hidden text-sm shrink-0">
              {listing.sellerAvatarPhoto ? (
                <img src={listing.sellerAvatarPhoto} alt="" className="w-full h-full object-cover" />
              ) : (
                listing.sellerAvatarEmoji
              )}
            </span>
            מפרסם/ת: {listing.sellerName}
          </div>

          {listing.description && <p className="text-sm text-neutral-300 leading-relaxed">{listing.description}</p>}
        </div>
      </div>

      <div className="px-5 py-4 border-t border-bg-border safe-bottom space-y-2">
        <div className="flex gap-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-600 text-white font-bold text-sm active:scale-95 transition"
          >
            <MessageCircle size={17} />
            הודעה בוואטסאפ
          </a>
          <a
            href={`tel:${listing.phone}`}
            className="w-14 flex items-center justify-center rounded-2xl bg-bg-panel2 border border-bg-border active:scale-95 transition"
          >
            <Phone size={17} className="text-neutral-300" />
          </a>
        </div>
        {isOwner && (
          <>
            {!confirmingRemove ? (
              <button
                onClick={() => setConfirmingRemove(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-red-400 text-xs font-semibold active:scale-95 transition"
              >
                <Trash2 size={13} />
                הסרת המודעה
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs text-red-300 font-semibold">להסיר את המודעה?</span>
                <button
                  onClick={() => onRemove(listing.id)}
                  className="px-3 py-2 rounded-xl bg-red-500 text-white text-xs font-bold active:scale-95 transition"
                >
                  כן, הסרה
                </button>
                <button
                  onClick={() => setConfirmingRemove(false)}
                  className="px-3 py-2 rounded-xl bg-bg-panel2 border border-bg-border text-neutral-300 text-xs font-semibold active:scale-95 transition"
                >
                  ביטול
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CreateListingView({ biasNear, onClose, onCreated }: { biasNear: LatLng; onClose: () => void; onCreated: () => void }) {
  const { user } = useApp();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleTypeId | "other" | undefined>(undefined);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [locationText, setLocationText] = useState("");
  const [locationPos, setLocationPos] = useState<LatLng | undefined>(undefined);
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit = title.trim().length > 0 && phone.trim().length > 0;

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - photos.length);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, reader.result as string]));
      reader.readAsDataURL(file);
    }
    e.target.value = "";
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
        photoDataUrls: photos,
        phone: phone.trim(),
        locationText: locationText.trim() || undefined,
        locationPosition: locationPos,
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
        <label className="text-xs text-neutral-400 mb-1.5 block">תמונות (עד {MAX_PHOTOS})</label>
        <div className="flex gap-2 mb-5 flex-wrap">
          {photos.map((p, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden">
              <img src={p} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 rounded-xl bg-bg-panel2 border border-dashed border-bg-border flex flex-col items-center justify-center gap-0.5"
            >
              <Camera size={16} className="text-neutral-500" />
              <span className="text-[9px] text-neutral-500">{photos.length}/{MAX_PHOTOS}</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />

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
        <div className="mb-4">
          <AddressAutocomplete
            biasNear={biasNear}
            onQueryChange={setLocationText}
            onSelect={(s) => {
              setLocationText(s.label);
              setLocationPos(s.position);
            }}
          />
        </div>

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

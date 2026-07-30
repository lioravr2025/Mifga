import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  Image as ImageIcon,
  Lock,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { isBackendConfigured } from "../lib/supabaseClient";
import {
  cancelMeetupRsvp,
  createMeetup,
  deleteMeetupRemote,
  fetchMeetupAttendees,
  fetchMeetups,
  rsvpToMeetup,
} from "../lib/backend/meetups";
import type { Meetup } from "../types";

function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function toLocalInputValue(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function MeetupsScreen({ onClose }: { onClose: () => void }) {
  const { user } = useApp();
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create">("list");
  const [selected, setSelected] = useState<Meetup | null>(null);

  const [cityQuery, setCityQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const load = () => {
    if (!isBackendConfigured || !user.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMeetups(user.id)
      .then(setMeetups)
      .catch((err) => console.error("Mifga: fetchMeetups failed", err))
      .finally(() => setLoading(false));
  };

  useEffect(load, [user.id]);

  const filtered = useMemo(() => {
    return meetups.filter((m) => {
      if (cityQuery.trim() && !m.locationText.toLowerCase().includes(cityQuery.trim().toLowerCase())) return false;
      if (dateFilter) {
        const d = new Date(m.startsAt).toISOString().slice(0, 10);
        if (d !== dateFilter) return false;
      }
      return true;
    });
  }, [meetups, cityQuery, dateFilter]);

  const toggleRsvp = async (m: Meetup) => {
    if (!user.id) return;
    try {
      if (m.isAttending) {
        await cancelMeetupRsvp(m.id, user.id);
      } else {
        await rsvpToMeetup(m.id, user.id);
      }
      load();
      if (selected?.id === m.id) {
        setSelected((s) => (s ? { ...s, isAttending: !s.isAttending, attendeeCount: s.attendeeCount + (s.isAttending ? -1 : 1) } : s));
      }
    } catch (err) {
      console.error("Mifga: RSVP failed", err);
    }
  };

  if (view === "create") {
    return (
      <CreateMeetupView
        onClose={() => setView("list")}
        onCreated={() => {
          setView("list");
          load();
        }}
      />
    );
  }

  if (selected) {
    return (
      <MeetupDetailView
        meetup={selected}
        isHost={selected.hostId === user.id}
        onBack={() => setSelected(null)}
        onToggleRsvp={() => toggleRsvp(selected)}
        onDeleted={() => {
          setSelected(null);
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
        <h1 className="text-lg font-bold text-neutral-50">מפגשים</h1>
        <button
          onClick={() => setView("create")}
          className="w-9 h-9 rounded-full bg-brand flex items-center justify-center active:scale-95 transition"
          title="יצירת מפגש"
        >
          <Plus size={18} className="text-white" />
        </button>
      </div>

      <div className="px-5 pt-4 pb-2 flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-bg-panel2 border border-bg-border">
          <Search size={15} className="text-neutral-500 shrink-0" />
          <input
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            placeholder="חיפוש לפי עיר..."
            className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2.5 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-neutral-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <Calendar size={32} className="text-neutral-600 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">אין עדיין מפגשים{cityQuery || dateFilter ? " שתואמים לחיפוש" : ""}</p>
          </div>
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className="w-full text-right rounded-2xl bg-bg-panel2 border border-bg-border overflow-hidden active:scale-[0.99] transition"
            >
              {m.coverPhotoUrl && <img src={m.coverPhotoUrl} alt="" className="w-full h-32 object-cover" />}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-sm font-bold text-neutral-50">{m.title}</span>
                  {m.privacy === "private" && <Lock size={13} className="text-neutral-500 shrink-0 mt-0.5" />}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-1">
                  <Calendar size={11} />
                  {fmtDateTime(m.startsAt)}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-2">
                  <MapPin size={11} />
                  {m.locationText}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                    <Users size={11} />
                    {m.attendeeCount} מגיעים{m.capacity ? ` מתוך ${m.capacity}` : ""}
                  </div>
                  {m.isAttending && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-green-400">
                      <Check size={12} />
                      אתם מגיעים
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function CreateMeetupView({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useApp();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [capacity, setCapacity] = useState("");
  const [coverPhoto, setCoverPhoto] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit = title.trim().length > 0 && locationText.trim().length > 0 && !!startsAt;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCoverPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!canSubmit || !user.id) return;
    setSubmitting(true);
    setError(null);
    try {
      await createMeetup({
        hostId: user.id,
        title: title.trim(),
        description: description.trim() || undefined,
        locationText: locationText.trim(),
        coverPhotoDataUrl: coverPhoto,
        startsAt: new Date(startsAt).getTime(),
        endsAt: endsAt ? new Date(endsAt).getTime() : undefined,
        privacy,
        capacity: capacity ? Number(capacity) : undefined,
      });
      onCreated();
    } catch (err) {
      console.error("Mifga: createMeetup failed", err);
      setError("יצירת המפגש נכשלה - נסו שוב");
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
        <h1 className="text-lg font-bold text-neutral-50">מפגש חדש</h1>
        <span className="w-9" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-4">
        <button onClick={() => fileRef.current?.click()} className="w-full h-32 rounded-2xl bg-bg-panel2 border border-dashed border-bg-border flex flex-col items-center justify-center gap-1.5 mb-5 overflow-hidden">
          {coverPhoto ? (
            <img src={coverPhoto} alt="" className="w-full h-full object-cover" />
          ) : (
            <>
              <Camera size={22} className="text-neutral-500" />
              <span className="text-xs text-neutral-500">תמונת נושא (אופציונלי)</span>
            </>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <label className="text-xs text-neutral-400 mb-1.5 block">שם האירוע *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="למשל: רכיבת ערב בטיילת"
          className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4"
        />

        <label className="text-xs text-neutral-400 mb-1.5 block">מיקום *</label>
        <input
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          placeholder="עיר או כתובת"
          className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4"
        />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">תאריך ושעת התחלה *</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              min={toLocalInputValue(Date.now())}
              className="w-full px-3 py-2.5 rounded-2xl bg-bg-panel2 border border-bg-border text-xs text-neutral-100 outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-400 mb-1.5 block">שעת סיום (רשות)</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              min={startsAt || undefined}
              className="w-full px-3 py-2.5 rounded-2xl bg-bg-panel2 border border-bg-border text-xs text-neutral-100 outline-none focus:border-brand"
            />
          </div>
        </div>

        <label className="text-xs text-neutral-400 mb-1.5 block">תיאור (רשות)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="פרטים נוספים על המפגש..."
          rows={3}
          className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4 resize-none"
        />

        <label className="text-xs text-neutral-400 mb-1.5 block">הגבלת משתתפים (רשות)</label>
        <input
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="ללא הגבלה"
          className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4"
        />

        <label className="text-xs text-neutral-400 mb-1.5 block">פרטיות</label>
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setPrivacy("public")}
            className={`flex-1 py-2.5 rounded-2xl border text-sm font-semibold transition ${
              privacy === "public" ? "bg-brand/15 border-brand text-brand-light" : "bg-bg-panel2 border-bg-border text-neutral-400"
            }`}
          >
            ציבורי
          </button>
          <button
            onClick={() => setPrivacy("private")}
            className={`flex-1 py-2.5 rounded-2xl border text-sm font-semibold transition ${
              privacy === "private" ? "bg-brand/15 border-brand text-brand-light" : "bg-bg-panel2 border-bg-border text-neutral-400"
            }`}
          >
            פרטי
          </button>
        </div>

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
          יצירת מפגש
        </button>
      </div>
    </div>
  );
}

function MeetupDetailView({
  meetup,
  isHost,
  onBack,
  onToggleRsvp,
  onDeleted,
}: {
  meetup: Meetup;
  isHost: boolean;
  onBack: () => void;
  onToggleRsvp: () => void;
  onDeleted: () => void;
}) {
  const [attendees, setAttendees] = useState<{ id: string; name: string; avatarEmoji: string; avatarPhoto?: string }[]>([]);
  const [showAttendees, setShowAttendees] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchMeetupAttendees(meetup.id)
      .then(setAttendees)
      .catch((err) => console.error("Mifga: fetchMeetupAttendees failed", err));
  }, [meetup.id]);

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteMeetupRemote(meetup.id);
      onDeleted();
    } catch (err) {
      console.error("Mifga: deleteMeetup failed", err);
      setDeleting(false);
    }
  };

  const full = !!meetup.capacity && meetup.attendeeCount >= meetup.capacity && !meetup.isAttending;

  return (
    <div className="absolute inset-0 z-[2500] bg-bg flex flex-col safe-top">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="relative">
          {meetup.coverPhotoUrl ? (
            <img src={meetup.coverPhotoUrl} alt="" className="w-full h-48 object-cover" />
          ) : (
            <div className="w-full h-24 bg-gradient-to-br from-brand to-purple-800" />
          )}
          <button onClick={onBack} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-bg/70 backdrop-blur flex items-center justify-center">
            <ArrowRight size={18} className="text-white" />
          </button>
          {isHost && (
            <button
              onClick={remove}
              disabled={deleting}
              className="absolute top-4 left-4 w-9 h-9 rounded-full bg-red-500/80 backdrop-blur flex items-center justify-center disabled:opacity-50"
              title="מחיקת מפגש"
            >
              {deleting ? <Loader2 size={15} className="text-white animate-spin" /> : <Trash2 size={15} className="text-white" />}
            </button>
          )}
        </div>

        <div className="px-5 py-5">
          <div className="flex items-center gap-1.5 mb-2">
            {meetup.privacy === "private" && <Lock size={13} className="text-neutral-500" />}
            <h1 className="text-xl font-bold text-neutral-50">{meetup.title}</h1>
          </div>

          <div className="flex items-center gap-2 mb-2 text-sm text-neutral-300">
            <Calendar size={15} className="text-brand-light shrink-0" />
            {fmtDateTime(meetup.startsAt)}
            {meetup.endsAt ? ` - ${fmtDateTime(meetup.endsAt)}` : ""}
          </div>
          <div className="flex items-center gap-2 mb-4 text-sm text-neutral-300">
            <MapPin size={15} className="text-brand-light shrink-0" />
            {meetup.locationText}
          </div>

          <div className="flex items-center gap-2 mb-1 text-xs text-neutral-500">
            <ImageIcon size={12} />
            מארח/ת: {meetup.hostName}
          </div>

          {meetup.description && <p className="text-sm text-neutral-300 leading-relaxed mt-3 mb-4">{meetup.description}</p>}

          <button
            onClick={() => setShowAttendees((s) => !s)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border mb-4"
          >
            <span className="flex items-center gap-2 text-sm text-neutral-200">
              <Users size={15} className="text-brand-light" />
              {meetup.attendeeCount} מגיעים{meetup.capacity ? ` מתוך ${meetup.capacity}` : ""}
            </span>
            <ChevronLeft size={16} className={`text-neutral-500 transition ${showAttendees ? "-rotate-90" : ""}`} />
          </button>

          {showAttendees && (
            <div className="space-y-2 mb-4">
              {attendees.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-2">אף אחד עוד לא אישר הגעה</p>
              ) : (
                attendees.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-bg-panel border border-bg-border">
                    <span className="w-8 h-8 rounded-full bg-bg-panel2 flex items-center justify-center overflow-hidden text-sm shrink-0">
                      {a.avatarPhoto ? <img src={a.avatarPhoto} alt="" className="w-full h-full object-cover" /> : a.avatarEmoji}
                    </span>
                    <span className="text-sm text-neutral-200">{a.name}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-4 border-t border-bg-border safe-bottom">
        <button
          onClick={onToggleRsvp}
          disabled={full}
          className={`w-full py-3.5 rounded-2xl font-bold text-base active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-40 ${
            meetup.isAttending ? "bg-bg-panel2 border border-bg-border text-neutral-200" : "bg-brand text-white"
          }`}
        >
          {meetup.isAttending ? <Check size={18} /> : <Users size={18} />}
          {full ? "המפגש מלא" : meetup.isAttending ? "מגיעים - לחצו לביטול" : "אישור הגעה"}
        </button>
      </div>
    </div>
  );
}

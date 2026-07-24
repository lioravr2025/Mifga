import { useRef, useState } from "react";
import { Bell, Camera, Footprints, Gauge, Shield, ShieldCheck, Siren, TriangleAlert, Zap } from "lucide-react";
import { useApp } from "../context/AppContext";
import { VEHICLE_DEFS } from "../components/VehicleIcons";
import VehicleModelInput from "../components/VehicleModelInput";
import UsernameField from "../components/UsernameField";
import InviteFriendButton from "../components/InviteFriendButton";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import { isUsernameTaken, isValidUsernameFormat } from "../lib/username";
import type { NotifyTypePrefs, VehicleTypeId } from "../types";

function isValidIsraeliPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  const normalized = digits.startsWith("972") ? "0" + digits.slice(3) : digits;
  return /^05\d{8}$/.test(normalized);
}

const NOTIFY_ROWS: { key: keyof NotifyTypePrefs; label: string; icon: typeof Siren; color: string }[] = [
  { key: "police", label: "שוטר", icon: Siren, color: HAZARD_COLOR_HEX.police },
  { key: "inspector", label: "פקח", icon: Shield, color: HAZARD_COLOR_HEX.inspector },
  { key: "other", label: "מפגע אחר", icon: TriangleAlert, color: HAZARD_COLOR_HEX.pothole },
];

export default function OnboardingScreen() {
  const { updateProfile, updateNotifyTypes, completeOnboarding, settings, hazards, friends } = useApp();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [vehicleType, setVehicleType] = useState<VehicleTypeId | undefined>(undefined);
  const [vehicleModel, setVehicleModel] = useState("");
  const [noVehicle, setNoVehicle] = useState(false);
  const [notifyTypes, setNotifyTypes] = useState<NotifyTypePrefs>(settings.notifyTypes);
  const fileRef = useRef<HTMLInputElement>(null);

  const phoneValid = isValidIsraeliPhone(phone);
  const usernameValid = isValidUsernameFormat(username) && !isUsernameTaken(username, friends.map((f) => f.username));
  const canSubmit = name.trim().length > 0 && phoneValid && usernameValid;

  const activeHazardsCount = hazards.length;
  // "tickets avoided" = distinct encounters with a police/inspector hazard reported in
  // the system - the original reporter plus everyone who confirmed "still there".
  const ticketsAvoided = hazards
    .filter((h) => h.type === "police" || h.type === "inspector")
    .reduce((sum, h) => sum + h.confirmations + 1, 0);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const selectVehicle = (id: VehicleTypeId) => {
    setNoVehicle(false);
    setVehicleType((prev) => (prev === id ? undefined : id));
  };

  const selectNoVehicle = () => {
    setVehicleType(undefined);
    setVehicleModel("");
    setNoVehicle((prev) => !prev);
  };

  const submit = () => {
    if (!canSubmit) return;
    updateProfile({
      name: name.trim(),
      username: username.trim(),
      phone: phone.trim(),
      avatarPhoto: photo ?? null,
      vehicleType: vehicleType ?? null,
      vehicleModel: vehicleType ? vehicleModel.trim() || null : null,
    });
    updateNotifyTypes(notifyTypes);
    completeOnboarding();
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar safe-top">
      <div className="px-6 pt-8 pb-6 bg-gradient-to-br from-brand to-purple-800 rounded-b-[2rem] mb-6">
        <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
          <Gauge size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-2">ברוכים הבאים ל-Mifga</h1>
        <p className="text-sm text-white/85 leading-relaxed mb-4">
          מפגע נועדה לעזור לכם לנסוע בטוח יותר, להימנע מקנסות ודוחות, ולדעת מראש מה קורה בדרך - שוטרים, פקחים ומפגעים - עוד לפני
          שאתם מגיעים אליהם. הרשמה קצרה ומתחילים.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-white/10 border border-white/15 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TriangleAlert size={13} className="text-white/80" />
              <span className="text-[10px] text-white/70">מפגעים פעילים כרגע</span>
            </div>
            <div className="text-xl font-extrabold text-white">{activeHazardsCount}</div>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/15 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck size={13} className="text-white/80" />
              <span className="text-[10px] text-white/70">דוחות שנחסכו הודות למפגע</span>
            </div>
            <div className="text-xl font-extrabold text-white">{ticketsAvoided}</div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-8">
        <div className="flex flex-col items-center mb-6">
          <button onClick={() => fileRef.current?.click()} className="relative w-24 h-24 mb-2 active:scale-95 transition">
            {photo ? (
              <img src={photo} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-brand" />
            ) : (
              <span className="w-24 h-24 rounded-full bg-bg-panel2 border-2 border-dashed border-bg-border flex items-center justify-center text-4xl">
                🧑
              </span>
            )}
            <span className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-brand flex items-center justify-center border-2 border-bg">
              <Camera size={15} className="text-white" />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()} className="text-xs text-brand-light font-semibold">
            {photo ? "החלפת תמונה" : "העלאת תמונה (אופציונלי)"}
          </button>
        </div>

        <label className="text-xs text-neutral-400 mb-1.5 block">כינוי *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="איך נקרא לך?"
          className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4"
        />

        <label className="text-xs text-neutral-400 mb-1.5 block">שם משתמש (ייחודי) *</label>
        <div className="mb-4">
          <UsernameField value={username} onChange={setUsername} />
        </div>

        <label className="text-xs text-neutral-400 mb-1.5 block">מספר טלפון *</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => setPhoneTouched(true)}
          placeholder="050-1234567"
          dir="ltr"
          className={`w-full px-4 py-3 rounded-2xl bg-bg-panel2 border text-sm text-neutral-100 outline-none mb-1 ${
            phoneTouched && phone && !phoneValid ? "border-red-500" : "border-bg-border focus:border-brand"
          }`}
        />
        {phoneTouched && phone && !phoneValid && <p className="text-[11px] text-red-400 mb-3">מספר טלפון לא תקין</p>}
        {!(phoneTouched && phone && !phoneValid) && <div className="mb-3" />}

        <label className="text-xs text-neutral-400 mb-1.5 block">הכלי שלי (אופציונלי)</label>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {VEHICLE_DEFS.map(({ id, label, Icon }) => {
            const active = vehicleType === id;
            return (
              <button
                key={id}
                onClick={() => selectVehicle(id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border active:scale-95 transition ${
                  active ? "bg-brand/15 border-brand" : "bg-bg-panel2 border-bg-border"
                }`}
              >
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center border ${
                    active ? "bg-brand/20 border-brand" : "bg-bg-panel border-bg-border"
                  }`}
                >
                  <Icon size={20} color={active ? "#a78bfa" : "#9ca3af"} />
                </span>
                <span className={`text-[11px] font-semibold text-center leading-tight ${active ? "text-brand-light" : "text-neutral-300"}`}>
                  {label}
                </span>
              </button>
            );
          })}
          <button
            onClick={selectNoVehicle}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border active:scale-95 transition ${
              noVehicle ? "bg-brand/15 border-brand" : "bg-bg-panel2 border-bg-border"
            }`}
          >
            <span
              className={`w-11 h-11 rounded-full flex items-center justify-center border ${
                noVehicle ? "bg-brand/20 border-brand" : "bg-bg-panel border-bg-border"
              }`}
            >
              <Footprints size={20} color={noVehicle ? "#a78bfa" : "#9ca3af"} />
            </span>
            <span className={`text-[11px] font-semibold text-center leading-tight ${noVehicle ? "text-brand-light" : "text-neutral-300"}`}>
              אין לי כלי
            </span>
          </button>
        </div>
        {vehicleType && (
          <div className="mb-4">
            <VehicleModelInput type={vehicleType} value={vehicleModel} onChange={setVehicleModel} />
          </div>
        )}

        <div className="p-4 rounded-2xl bg-bg-panel2 border border-bg-border mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={15} className="text-brand-light" />
            <span className="text-sm font-semibold text-neutral-50">על מה תרצו לקבל התרעה?</span>
          </div>
          <div className="space-y-2.5">
            {NOTIFY_ROWS.map(({ key, label, icon: Icon, color }) => {
              const checked = notifyTypes[key];
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} style={{ color }} />
                    <span className="text-sm text-neutral-200">{label}</span>
                  </div>
                  <button
                    onClick={() => setNotifyTypes((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className={`w-10 h-6 rounded-full relative transition ${checked ? "bg-brand" : "bg-neutral-600"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${checked ? "right-0.5" : "right-[18px]"}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <InviteFriendButton label="מכירים עוד רוכבים? הזמינו אותם" />
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full py-4 rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-40 active:scale-95 transition flex items-center justify-center gap-2"
        >
          <Zap size={18} />
          בואו נתחיל לנסוע בטוח
        </button>
        {!canSubmit && (
          <p className="text-[11px] text-neutral-500 text-center mt-2">כינוי, שם משתמש ייחודי, ומספר טלפון תקין נדרשים כדי להמשיך</p>
        )}
      </div>
    </div>
  );
}

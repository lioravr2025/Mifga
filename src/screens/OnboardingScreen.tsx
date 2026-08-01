import { useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Camera,
  Gauge,
  Gift,
  KeyRound,
  Loader2,
  LogIn,
  Shield,
  ShieldCheck,
  Siren,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { VEHICLE_DEFS } from "../components/VehicleIcons";
import VehicleModelInput from "../components/VehicleModelInput";
import UsernameField from "../components/UsernameField";
import InviteFriendButton from "../components/InviteFriendButton";
import TermsSheet from "../components/TermsSheet";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import { submitSupportTicket } from "../lib/backend/auth";
import type { NotifyTypePrefs, VehicleTypeId } from "../types";

/** Strips dashes/spaces/+972 prefix down to the canonical 05XXXXXXXX form that's actually stored - recover_account() does an exact string match, so any formatting drift here silently "fails" as a wrong code. */
function normalizeIsraeliPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("972") ? "0" + digits.slice(3) : digits;
}

function isValidIsraeliPhone(raw: string): boolean {
  return /^05\d{8}$/.test(normalizeIsraeliPhone(raw));
}

// "other" is last on purpose - it's the only one that's off by default.
const NOTIFY_ROWS: { key: keyof NotifyTypePrefs; label: string; icon: typeof Siren; color: string }[] = [
  { key: "police", label: "שוטר", icon: Siren, color: HAZARD_COLOR_HEX.police },
  { key: "inspector", label: "פקח", icon: Shield, color: HAZARD_COLOR_HEX.inspector },
  { key: "meetups", label: "מפגשים", icon: Users, color: "#a78bfa" },
  { key: "prizes", label: "פרסים", icon: Gift, color: "#f59e0b" },
  { key: "other", label: "מפגע אחר", icon: TriangleAlert, color: HAZARD_COLOR_HEX.pothole },
];

type Mode = "signup" | "login" | "support";

export default function OnboardingScreen() {
  const { updateNotifyTypes, completeOnboarding, recoverAccount, settings, hazards } = useApp();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameOk, setUsernameOk] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [vehicleType, setVehicleType] = useState<VehicleTypeId | undefined>(undefined);
  const [vehicleModel, setVehicleModel] = useState("");
  const [notifyTypes, setNotifyTypes] = useState<NotifyTypePrefs>(settings.notifyTypes);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCodeConfirm, setRecoveryCodeConfirm] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // login mode
  const [loginPhone, setLoginPhone] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // "forgot my code" support ticket mode
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportSent, setSupportSent] = useState(false);

  const phoneValid = isValidIsraeliPhone(phone);
  const recoveryCodeValid = recoveryCode.length === 6 && recoveryCode === recoveryCodeConfirm;
  const canSubmit = name.trim().length > 0 && phoneValid && usernameOk && !!vehicleType && recoveryCodeValid && !submitting;

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
    setVehicleType(id);
  };

  // The rider picks their own recovery code (typed twice, to catch typos) instead
  // of the app generating one for them - so nothing needs to be "revealed" before
  // submitting, unlike the old flow.
  const submitSignup = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await completeOnboarding({
        name: name.trim(),
        username: username.trim(),
        phone: normalizeIsraeliPhone(phone),
        avatarPhoto: photo ?? null,
        vehicleType: vehicleType ?? null,
        vehicleModel: vehicleType ? vehicleModel.trim() || null : null,
        recoveryCode,
      });
      updateNotifyTypes(notifyTypes);
    } catch (err) {
      console.error("Mifga: onboarding failed", err);
      // A real connectivity failure surfaces as a TypeError from fetch() itself (can't reach
      // the server at all); anything else is a response we DID get back, with a real reason -
      // showing that reason beats a generic "check your internet" that's misleading and
      // impossible to debug from a bug report.
      if (err instanceof TypeError) {
        setSubmitError("ההרשמה נכשלה - בדקו את החיבור לאינטרנט ונסו שוב");
      } else {
        const message = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "שגיאה לא צפויה";
        setSubmitError(`ההרשמה נכשלה: ${message}`);
      }
      setSubmitting(false);
    }
  };

  const submitLogin = async () => {
    setLoginSubmitting(true);
    setLoginError(null);
    const ok = await recoverAccount(normalizeIsraeliPhone(loginPhone), loginCode);
    setLoginSubmitting(false);
    if (!ok) setLoginError("מספר טלפון או קוד שגויים.");
  };

  const submitSupport = async () => {
    if (!supportMessage.trim()) return;
    setSupportSubmitting(true);
    try {
      await submitSupportTicket(normalizeIsraeliPhone(loginPhone) || null, supportMessage.trim());
      setSupportSent(true);
    } catch (err) {
      console.error("Mifga: submitSupportTicket failed", err);
    }
    setSupportSubmitting(false);
  };

  if (mode === "login" || mode === "support") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar safe-top px-6 pt-10 pb-8">
        <span className="w-14 h-14 rounded-2xl bg-brand/15 border border-brand/40 flex items-center justify-center mb-4">
          <LogIn size={26} className="text-brand-light" />
        </span>
        {mode === "login" ? (
          <>
            <h1 className="text-xl font-bold text-neutral-50 mb-2">התחברות לחשבון קיים</h1>
            <p className="text-sm text-neutral-400 leading-relaxed mb-5">
              הזינו את מספר הטלפון וקוד השחזור בן 6 הספרות שבחרתם בהרשמה - כל הנתונים שלכם (נקודות, דיווחים, חברים) יחזרו.
            </p>
            <label className="text-xs text-neutral-400 mb-1.5 block">מספר טלפון</label>
            <input
              value={loginPhone}
              onChange={(e) => setLoginPhone(e.target.value)}
              placeholder="050-1234567"
              dir="ltr"
              className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4"
            />
            <label className="text-xs text-neutral-400 mb-1.5 block">קוד שחזור (6 ספרות)</label>
            <input
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              dir="ltr"
              inputMode="numeric"
              className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-center text-lg tracking-[0.4em] text-neutral-100 outline-none focus:border-brand mb-4"
            />
            {loginError && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs font-semibold mb-4">
                <AlertTriangle size={14} className="shrink-0" />
                {loginError}
              </div>
            )}
            <button
              onClick={submitLogin}
              disabled={!loginPhone.trim() || loginCode.length !== 6 || loginSubmitting}
              className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition flex items-center justify-center gap-2 mb-4"
            >
              {loginSubmitting && <Loader2 size={16} className="animate-spin" />}
              התחברות
            </button>
            <div className="flex items-center justify-between text-xs">
              <button onClick={() => setMode("signup")} className="text-neutral-400">
                חזרה להרשמה
              </button>
              <button onClick={() => setMode("support")} className="text-brand-light font-semibold">
                שכחתי את הקוד
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-neutral-50 mb-2">פנייה לתמיכה</h1>
            {supportSent ? (
              <div className="p-4 rounded-2xl bg-brand/10 border border-brand/30 text-sm text-neutral-200 text-center leading-relaxed">
                הפנייה נשלחה. ניצור קשר למספר הטלפון שהזנתם.
                <button onClick={() => setMode("login")} className="block mx-auto mt-3 text-brand-light font-semibold text-sm">
                  חזרה להתחברות
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-neutral-400 leading-relaxed mb-5">
                  ספרו לנו מה קרה ואיזה מספר טלפון רשום אצלכם - ניצור קשר כדי לעזור לכם לשחזר את החשבון.
                </p>
                <label className="text-xs text-neutral-400 mb-1.5 block">מספר טלפון</label>
                <input
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="050-1234567"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4"
                />
                <label className="text-xs text-neutral-400 mb-1.5 block">מה קרה?</label>
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="שכחתי את קוד השחזור שלי..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-4 resize-none"
                />
                <button
                  onClick={submitSupport}
                  disabled={!supportMessage.trim() || supportSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition flex items-center justify-center gap-2 mb-4"
                >
                  {supportSubmitting && <Loader2 size={16} className="animate-spin" />}
                  שליחת פנייה
                </button>
                <button onClick={() => setMode("login")} className="w-full text-center text-xs text-neutral-400">
                  חזרה להתחברות
                </button>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar safe-top">
      <div className="px-6 pt-8 pb-6 bg-gradient-to-br from-brand to-purple-800 rounded-b-[2rem] mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <Gauge size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white leading-tight" dir="ltr">
              Mifga
            </h1>
            <p className="text-xs font-semibold text-white/80">האפליקציה של רוכבי הכלים החשמליים</p>
          </div>
        </div>
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
          <UsernameField value={username} onChange={setUsername} onValidityChange={setUsernameOk} />
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

        <label className="text-xs text-neutral-400 mb-1.5 block">הכלי שלי *</label>
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
        </div>
        {vehicleType && (
          <div className="mb-4">
            <VehicleModelInput type={vehicleType} value={vehicleModel} onChange={setVehicleModel} />
          </div>
        )}

        <div className="p-4 rounded-2xl bg-bg-panel2 border border-bg-border mb-6">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound size={15} className="text-brand-light" />
            <span className="text-sm font-semibold text-neutral-50">קוד שחזור אישי (6 ספרות) *</span>
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed mb-3">
            בחרו בעצמכם קוד בן 6 ספרות וזכרו אותו - הוא ישמש אתכם להתחברות מחדש עם החשבון אם תמחקו את האפליקציה ותתקינו אותה מחדש.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] text-neutral-400 mb-1 block">קוד</label>
              <input
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                dir="ltr"
                inputMode="numeric"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-center text-sm tracking-[0.3em] text-neutral-100 outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-[11px] text-neutral-400 mb-1 block">אימות קוד</label>
              <input
                value={recoveryCodeConfirm}
                onChange={(e) => setRecoveryCodeConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                dir="ltr"
                inputMode="numeric"
                className="w-full px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-center text-sm tracking-[0.3em] text-neutral-100 outline-none focus:border-brand"
              />
            </div>
          </div>
          {recoveryCode.length === 6 && recoveryCodeConfirm.length === 6 && recoveryCode !== recoveryCodeConfirm && (
            <p className="text-[11px] text-red-400 mt-2">הקודים לא תואמים</p>
          )}
        </div>

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

        {submitError && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs font-semibold mb-3">
            <AlertTriangle size={14} className="shrink-0" />
            {submitError}
          </div>
        )}

        <button
          onClick={submitSignup}
          disabled={!canSubmit}
          className="w-full py-4 rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-40 active:scale-95 transition flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
          {submitting ? "נרשמים..." : "בואו נתחיל לנסוע בטוח"}
        </button>
        {!canSubmit && (
          <p className="text-[11px] text-neutral-500 text-center mt-2">
            כינוי, שם משתמש ייחודי, מספר טלפון תקין, הכלי שלך, וקוד שחזור תואם בן 6 ספרות נדרשים כדי להמשיך
          </p>
        )}
        <button onClick={() => setMode("login")} className="w-full text-center text-xs text-brand-light font-semibold mt-4">
          כבר יש לכם חשבון? התחברות
        </button>
        <p className="text-[10px] text-neutral-500 text-center mt-3">
          שימוש באפליקציה מהווה הסכמה ל
          <button onClick={() => setTermsOpen(true)} className="text-brand-light underline decoration-dotted underline-offset-2">
            תנאי השימוש
          </button>
        </p>
      </div>

      <TermsSheet open={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  );
}

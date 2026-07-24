import { useState } from "react";
import { Bell, Check, Gift, Lock, Moon, Send, Shield, Siren, Sun, TriangleAlert, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { useApp } from "../context/AppContext";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import { vehicleLabel } from "./VehicleIcons";
import type { NotifyTypePrefs } from "../types";

const NOTIFY_TYPE_ROWS: { key: keyof NotifyTypePrefs; label: string; icon: typeof Siren; color: string }[] = [
  { key: "police", label: "שוטר", icon: Siren, color: HAZARD_COLOR_HEX.police },
  { key: "inspector", label: "פקח", icon: Shield, color: HAZARD_COLOR_HEX.inspector },
  { key: "other", label: "מפגע אחר", icon: TriangleAlert, color: HAZARD_COLOR_HEX.pothole },
];

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, settings, updateSettings, updateNotifyTypes } = useApp();
  const [showUpsell, setShowUpsell] = useState(false);
  const [referralPhone, setReferralPhone] = useState("");
  const [referralSent, setReferralSent] = useState(false);

  const phoneDigits = referralPhone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 9;
  const vehicleLine = user.vehicleType
    ? `${user.name} רוכב/ת על ${vehicleLabel(user.vehicleType)}${user.vehicleModel ? " " + user.vehicleModel : ""}. `
    : "";
  const composedInvite = `${user.name} הזמין/ה אותך להצטרף ל-Mifga! ${vehicleLine}הורידו את האפליקציה כדי לדווח ולהימנע ממפגעים בדרכים: mifga.app/join`;

  const sendReferral = () => {
    if (!phoneValid) return;
    setReferralSent(true);
  };

  const toggleNotifications = async () => {
    if (!settings.notificationsEnabled) {
      if ("Notification" in window) {
        try {
          const perm = await Notification.requestPermission();
          updateSettings({ notificationsEnabled: perm === "granted" });
          return;
        } catch {
          // ignore - fall through to optimistic enable for unsupported browsers
        }
      }
      updateSettings({ notificationsEnabled: true });
    } else {
      updateSettings({ notificationsEnabled: false });
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="70%">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-neutral-50">הגדרות</h2>
        <button onClick={onClose} className="text-neutral-400">
          <X size={22} />
        </button>
      </div>

      <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-panel2 border border-bg-border mb-3">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-bg-panel flex items-center justify-center">
            {settings.theme === "dark" ? <Moon size={17} className="text-brand-light" /> : <Sun size={17} className="text-amber-400" />}
          </span>
          <div>
            <div className="text-sm font-semibold text-neutral-50">מצב תצוגה</div>
            <div className="text-xs text-neutral-400">{settings.theme === "dark" ? "כהה" : "בהיר"}</div>
          </div>
        </div>
        <button
          onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
          className={`w-12 h-7 rounded-full relative transition ${settings.theme === "dark" ? "bg-brand" : "bg-neutral-300"}`}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${settings.theme === "dark" ? "right-0.5" : "right-[22px]"}`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-panel2 border border-bg-border mb-3">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-bg-panel flex items-center justify-center">
            <Bell size={17} className="text-brand-light" />
          </span>
          <div>
            <div className="text-sm font-semibold text-neutral-50">התראות מפגעים</div>
            <div className="text-xs text-neutral-400">פוש כשיש מפגע בסביבתך</div>
          </div>
        </div>
        <button
          onClick={toggleNotifications}
          className={`w-12 h-7 rounded-full relative transition ${settings.notificationsEnabled ? "bg-brand" : "bg-neutral-600"}`}
        >
          <span
            className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${settings.notificationsEnabled ? "right-0.5" : "right-[22px]"}`}
          />
        </button>
      </div>

      {settings.notificationsEnabled && (
        <>
          <div className="p-4 rounded-2xl bg-bg-panel2 border border-bg-border mb-3">
            <div className="text-sm font-semibold text-neutral-50 mb-3">על מה להתריע</div>
            <div className="space-y-2.5">
              {NOTIFY_TYPE_ROWS.map(({ key, label, icon: Icon, color }) => {
                const checked = settings.notifyTypes[key];
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Icon size={16} style={{ color }} />
                      <span className="text-sm text-neutral-200">{label}</span>
                    </div>
                    <button
                      onClick={() => updateNotifyTypes({ [key]: !checked } as Partial<NotifyTypePrefs>)}
                      className={`w-10 h-6 rounded-full relative transition ${checked ? "bg-brand" : "bg-neutral-600"}`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${checked ? "right-0.5" : "right-[18px]"}`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-bg-panel2 border border-bg-border mb-3">
            <div className="text-sm font-semibold text-neutral-50 mb-3">כמות התראות ביום</div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => updateSettings({ notifyDailyLimit: "limited" })}
                className={`flex flex-col items-center gap-1 py-3 rounded-2xl border active:scale-95 transition ${
                  settings.notifyDailyLimit === "limited" ? "bg-brand/15 border-brand" : "bg-bg-panel border-bg-border"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {settings.notifyDailyLimit === "limited" && <Check size={13} className="text-brand-light" />}
                  <span className={`text-sm font-semibold ${settings.notifyDailyLimit === "limited" ? "text-brand-light" : "text-neutral-200"}`}>
                    עד 3 ביום
                  </span>
                </div>
                <span className="text-[10px] text-neutral-500">חינם</span>
              </button>
              <button
                onClick={() => setShowUpsell(true)}
                className="flex flex-col items-center gap-1 py-3 rounded-2xl border border-bg-border bg-bg-panel active:scale-95 transition opacity-80"
              >
                <div className="flex items-center gap-1.5">
                  <Lock size={12} className="text-neutral-400" />
                  <span className="text-sm font-semibold text-neutral-300">ללא הגבלה</span>
                </div>
                <span className="text-[10px] text-amber-400">בתשלום · בקרוב</span>
              </button>
            </div>
            {showUpsell && (
              <div className="mt-3 p-3 rounded-xl bg-brand/10 border border-brand/30">
                <div className="flex items-start gap-2 mb-3">
                  <Gift size={16} className="text-brand-light shrink-0 mt-0.5" />
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    התראות ללא הגבלה הן תכונת פרימיום. במקום לשלם, אפשר לקבל אותן בחינם - הזמינו חבר למפגע! הזינו את הטלפון שלו, הוא
                    יקבל הודעה עם קישור להורדת האפליקציה, ויירשם אצלו מי הזמין אותו ובאיזה כלי הוא/היא רוכב/ת.
                  </p>
                </div>

                {referralSent ? (
                  <div className="px-3 py-2.5 rounded-xl bg-green-500/15 border border-green-500/40 text-green-300 text-xs font-semibold text-center">
                    ההזמנה נשלחה ל-{referralPhone} 🎉 ברגע שהחבר יצטרף, ההתראות ללא הגבלה ייפתחו אצלכם.
                  </div>
                ) : (
                  <>
                    <input
                      value={referralPhone}
                      onChange={(e) => setReferralPhone(e.target.value)}
                      placeholder="מספר הטלפון של החבר"
                      dir="ltr"
                      className="w-full px-3 py-2.5 rounded-xl bg-bg-panel border border-bg-border text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-brand mb-2"
                    />
                    <div className="px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-[10px] text-neutral-500 leading-relaxed mb-2">
                      {composedInvite}
                    </div>
                    <button
                      onClick={sendReferral}
                      disabled={!phoneValid}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand text-white text-sm font-bold disabled:opacity-40 active:scale-95 transition"
                    >
                      <Send size={14} />
                      שליחת הזמנה
                    </button>
                    <p className="text-[10px] text-neutral-500 mt-1.5 text-center">הדגמה מקומית - כרגע לא נשלח SMS אמיתי</p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-bg-panel2 border border-bg-border">
            <div className="text-sm font-semibold text-neutral-50 mb-2">רדיוס התראה</div>
            <input
              type="range"
              min={200}
              max={3000}
              step={100}
              value={settings.notifyRadiusM}
              onChange={(e) => updateSettings({ notifyRadiusM: Number(e.target.value) })}
              className="w-full accent-brand"
            />
            <div className="text-xs text-neutral-400 mt-1">{settings.notifyRadiusM} מטר</div>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

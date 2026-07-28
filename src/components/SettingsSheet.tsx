import { Bell, KeyRound, Map, Shield, Siren, TriangleAlert, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { useApp } from "../context/AppContext";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import type { NotifyTypePrefs } from "../types";

const NOTIFY_TYPE_ROWS: { key: keyof NotifyTypePrefs; label: string; icon: typeof Siren; color: string }[] = [
  { key: "police", label: "שוטר", icon: Siren, color: HAZARD_COLOR_HEX.police },
  { key: "inspector", label: "פקח", icon: Shield, color: HAZARD_COLOR_HEX.inspector },
  { key: "other", label: "מפגע אחר", icon: TriangleAlert, color: HAZARD_COLOR_HEX.pothole },
];

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, settings, updateSettings, updateNotifyTypes } = useApp();

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
            <Map size={17} className="text-brand-light" />
          </span>
          <div>
            <div className="text-sm font-semibold text-neutral-50">מצב תצוגת מפה</div>
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

      <div className="p-4 rounded-2xl bg-bg-panel2 border border-bg-border mb-3">
        <div className="flex items-center justify-between">
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
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${
                settings.notificationsEnabled ? "right-0.5" : "right-[22px]"
              }`}
            />
          </button>
        </div>
        <div className="mt-3 pt-3 border-t border-bg-border">
          <div className="text-xs font-semibold text-neutral-300 mb-1">רדיוס התרעות בזמן נסיעה</div>
          <p className="text-xs text-neutral-400 mb-2 leading-relaxed">
            ברירת המחדל היא 100 מטר. כל עוד לא לחצתם "תחילת נסיעה" תראו את המפגעים על המפה בלבד - הצפצופים מתרחשים רק בעת נסיעה
            פעילה, כשמפגע נכנס לטווח שקבעתם כאן.
          </p>
          <input
            type="range"
            min={10}
            max={200}
            step={10}
            value={settings.rideAlertRadiusM}
            onChange={(e) => updateSettings({ rideAlertRadiusM: Number(e.target.value) })}
            className="w-full accent-brand"
          />
          <div className="text-xs text-neutral-400 mt-1">{settings.rideAlertRadiusM} מטר</div>
        </div>
      </div>

      {settings.notificationsEnabled && (
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
      )}

      {user.recoveryCode && (
        <div className="p-4 rounded-2xl bg-bg-panel2 border border-bg-border mt-3">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-9 h-9 rounded-full bg-bg-panel flex items-center justify-center">
              <KeyRound size={17} className="text-brand-light" />
            </span>
            <div>
              <div className="text-sm font-semibold text-neutral-50">קוד שחזור חשבון</div>
              <div className="text-xs text-neutral-400">להתחברות מחדש אם תתקינו את האפליקציה מחדש</div>
            </div>
          </div>
          <div className="text-2xl font-extrabold tracking-[0.3em] text-brand-light text-center bg-bg-panel rounded-xl py-2.5" dir="ltr">
            {user.recoveryCode}
          </div>
        </div>
      )}

      <p className="text-[11px] text-neutral-600 text-center mt-5" dir="ltr">
        Mifga v{__APP_VERSION__}
      </p>
    </BottomSheet>
  );
}

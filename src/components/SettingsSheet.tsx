import { useState } from "react";
import { Bell, Gift, LogOut, Map, Shield, Siren, Trash2, TriangleAlert, Users, Volume2, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { useApp } from "../context/AppContext";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import { useHebrewVoices } from "../hooks/useHebrewVoices";
import { isSpeechSupported } from "../lib/speech";
import type { NotifyTypePrefs } from "../types";

// "other" is last on purpose - it's the only one that's off by default, so
// it reads as the exception at the bottom rather than breaking up the "all
// on" group above it.
const NOTIFY_TYPE_ROWS: { key: keyof NotifyTypePrefs; label: string; icon: typeof Siren; color: string }[] = [
  { key: "police", label: "שוטר", icon: Siren, color: HAZARD_COLOR_HEX.police },
  { key: "inspector", label: "פקח", icon: Shield, color: HAZARD_COLOR_HEX.inspector },
  { key: "meetups", label: "מפגשים", icon: Users, color: "#a78bfa" },
  { key: "prizes", label: "פרסים", icon: Gift, color: "#f59e0b" },
  { key: "other", label: "מפגע אחר", icon: TriangleAlert, color: HAZARD_COLOR_HEX.pothole },
];

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, updateNotifyTypes, logout, deleteAccount } = useApp();
  const hebrewVoices = useHebrewVoices();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [working, setWorking] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const handleLogout = async () => {
    setWorking(true);
    setAccountError(null);
    try {
      await logout();
      onClose();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "ההתנתקות נכשלה - נסו שוב");
    } finally {
      setWorking(false);
      setConfirmingLogout(false);
    }
  };

  const handleDeleteAccount = async () => {
    setWorking(true);
    setAccountError(null);
    try {
      await deleteAccount();
      onClose();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "מחיקת החשבון נכשלה - נסו שוב");
    } finally {
      setWorking(false);
      setConfirmingDelete(false);
    }
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

      {isSpeechSupported() && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-panel2 border border-bg-border mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full bg-bg-panel flex items-center justify-center shrink-0">
              <Volume2 size={17} className="text-brand-light" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-neutral-50">קול הנחיה בנסיעה</div>
              {hebrewVoices.length > 0 ? (
                <div className="text-xs text-neutral-400">בחרו קול עברי להנחיות הניווט</div>
              ) : (
                <div className="text-xs text-neutral-400">לא נמצא קול עברי במכשיר - ההנחיה הקולית מושתקת עד שיותקן</div>
              )}
            </div>
          </div>
          {hebrewVoices.length > 0 && (
            <select
              value={settings.voiceURI && hebrewVoices.some((v) => v.voiceURI === settings.voiceURI) ? settings.voiceURI : hebrewVoices[0].voiceURI}
              onChange={(e) => updateSettings({ voiceURI: e.target.value })}
              className="shrink-0 max-w-[38%] bg-bg-panel border border-bg-border rounded-lg px-2 py-1.5 text-xs text-neutral-200"
            >
              {hebrewVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

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

      <div className="mt-5 pt-4 border-t border-bg-border space-y-2">
        {!confirmingLogout ? (
          <button
            onClick={() => setConfirmingLogout(true)}
            disabled={working}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-neutral-500 active:text-neutral-300 transition disabled:opacity-40"
          >
            <LogOut size={13} />
            התנתקות
          </button>
        ) : (
          <div className="flex items-center gap-2 px-1">
            <span className="flex-1 text-xs text-neutral-400">להתנתק? תוכלו לחזור עם מספר הטלפון וקוד השחזור.</span>
            <button
              onClick={handleLogout}
              disabled={working}
              className="px-3 py-1.5 rounded-lg bg-bg-panel2 border border-bg-border text-xs font-semibold text-neutral-200 active:scale-95 transition disabled:opacity-40"
            >
              {working ? "..." : "כן"}
            </button>
            <button
              onClick={() => setConfirmingLogout(false)}
              disabled={working}
              className="px-3 py-1.5 text-xs text-neutral-500 active:text-neutral-300 transition"
            >
              ביטול
            </button>
          </div>
        )}

        {!confirmingDelete ? (
          <button
            onClick={() => setConfirmingDelete(true)}
            disabled={working}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-red-400/70 active:text-red-400 transition disabled:opacity-40"
          >
            <Trash2 size={13} />
            מחיקת חשבון
          </button>
        ) : (
          <div className="flex items-center gap-2 px-1">
            <span className="flex-1 text-xs text-red-300 font-semibold">למחוק את החשבון לצמיתות? אי אפשר לבטל.</span>
            <button
              onClick={handleDeleteAccount}
              disabled={working}
              className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold active:scale-95 transition disabled:opacity-40"
            >
              {working ? "..." : "כן, מחיקה"}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={working}
              className="px-3 py-1.5 text-xs text-neutral-500 active:text-neutral-300 transition"
            >
              ביטול
            </button>
          </div>
        )}

        {accountError && (
          <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-center">{accountError}</p>
        )}
      </div>

      <p className="text-[11px] text-neutral-600 text-center mt-4" dir="ltr">
        Mifga v{__APP_VERSION__}
      </p>
    </BottomSheet>
  );
}

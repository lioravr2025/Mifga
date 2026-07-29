import { useState } from "react";
import { DownloadCloud, X } from "lucide-react";
import { loadJSON, saveJSON } from "../lib/storage";

const DOWNLOAD_URL = "https://israel-ai.org/mifga";

/** Non-blocking counterpart to UpdateRequiredScreen - shown when a newer version exists but isn't mandatory (see admin dashboard's "עדכון חובה" toggle). Dismissal is keyed by version, so a *later* optional release still nudges again. */
export default function UpdateNudge({ latestVersion, message }: { latestVersion: string; message: string | null }) {
  const dismissedKey = `dismissedUpdateNudge:${latestVersion}`;
  const [dismissed, setDismissed] = useState(() => loadJSON<boolean>(dismissedKey, false));

  if (dismissed) return null;

  const dismiss = () => {
    saveJSON(dismissedKey, true);
    setDismissed(true);
  };

  return (
    <div className="absolute top-4 inset-x-4 z-[1900] flex items-center gap-3 px-4 py-3 rounded-2xl bg-bg-panel/95 backdrop-blur border border-brand/40 shadow-2xl safe-top animate-slideUp">
      <span className="w-9 h-9 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
        <DownloadCloud size={16} className="text-brand-light" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-neutral-50">יש גרסה חדשה ל-Mifga</p>
        <p className="text-[11px] text-neutral-400 truncate">{message || "כדאי לעדכן כשנוח לכם"}</p>
      </div>
      <a
        href={DOWNLOAD_URL}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 px-3 py-2 rounded-xl bg-brand text-white text-xs font-bold active:scale-95 transition"
      >
        עדכון
      </a>
      <button onClick={dismiss} className="shrink-0 text-neutral-500 active:text-neutral-300" title="סגירה">
        <X size={16} />
      </button>
    </div>
  );
}

import { useState } from "react";
import { Copy, Check, MessageCircle, Send, Share2, UserPlus } from "lucide-react";
import BottomSheet from "./BottomSheet";

// Points at the landing page during the closed pilot, since there's no app-store listing yet.
const INVITE_URL = "https://israel-ai.org/mifga";
const INVITE_TEXT = `מצאתי אפליקציה שמונעת דוחות וקנסות ועוזרת לנסוע בטוח - Mifga! 🛴 תורידו אותה: ${INVITE_URL}`;

/**
 * The Web Share API opens the device's native share sheet (WhatsApp,
 * Telegram, SMS, whatever's installed) - free, no business account, no
 * per-message cost, unlike WhatsApp Business API or an SMS gateway. It's not
 * supported on every desktop browser, so this falls back to direct share
 * links + a copy button.
 */
export default function InviteFriendButton({
  variant = "card",
  label = "הזמינו חברים ל-Mifga",
}: {
  variant?: "card" | "compact" | "link";
  label?: string;
}) {
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: INVITE_TEXT, url: INVITE_URL });
        return;
      } catch {
        // user cancelled the native sheet, or it failed - fall through to the manual fallback
      }
    }
    setFallbackOpen(true);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(INVITE_TEXT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard permission denied - links below still work
    }
  };

  return (
    <>
      {variant === "link" ? (
        <button onClick={share} className="text-brand-light font-semibold underline decoration-dotted underline-offset-2">
          {label}
        </button>
      ) : variant === "card" ? (
        <button
          onClick={share}
          className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/40 active:scale-[0.98] transition"
        >
          <span className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
            <UserPlus size={18} className="text-brand-light" />
          </span>
          <div className="text-right flex-1">
            <div className="text-sm font-bold text-neutral-50">{label}</div>
            <div className="text-[11px] text-neutral-400">שתפו את האפליקציה בוואטסאפ, טלגרם או SMS</div>
          </div>
          <Share2 size={16} className="text-brand-light shrink-0" />
        </button>
      ) : (
        <button
          onClick={share}
          className="w-10 h-10 rounded-xl bg-bg-panel border border-bg-border flex items-center justify-center active:scale-95 transition"
          title={label}
        >
          <Share2 size={18} className="text-neutral-300" />
        </button>
      )}

      <BottomSheet open={fallbackOpen} onClose={() => setFallbackOpen(false)} maxHeight="55%">
        <h2 className="text-lg font-bold text-neutral-50 mb-1">הזמינו חבר</h2>
        <p className="text-xs text-neutral-400 mb-4">בחרו איך לשלוח את ההזמנה</p>

        <div className="space-y-2.5 mb-4">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(INVITE_TEXT)}`}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-bg-panel2 border border-bg-border active:scale-[0.98] transition"
          >
            <span className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center">
              <MessageCircle size={17} className="text-green-400" />
            </span>
            <span className="text-sm font-semibold text-neutral-100">WhatsApp</span>
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(INVITE_URL)}&text=${encodeURIComponent(INVITE_TEXT)}`}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-bg-panel2 border border-bg-border active:scale-[0.98] transition"
          >
            <span className="w-9 h-9 rounded-full bg-sky-500/15 flex items-center justify-center">
              <Send size={16} className="text-sky-400" />
            </span>
            <span className="text-sm font-semibold text-neutral-100">Telegram</span>
          </a>
          <a
            href={`sms:?body=${encodeURIComponent(INVITE_TEXT)}`}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-bg-panel2 border border-bg-border active:scale-[0.98] transition"
          >
            <span className="w-9 h-9 rounded-full bg-brand/15 flex items-center justify-center">
              <MessageCircle size={17} className="text-brand-light" />
            </span>
            <span className="text-sm font-semibold text-neutral-100">SMS</span>
          </a>
        </div>

        <button
          onClick={copyText}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm font-semibold text-neutral-200 active:scale-95 transition"
        >
          {copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
          {copied ? "הועתק!" : "העתקת הטקסט"}
        </button>
      </BottomSheet>
    </>
  );
}

import { Sparkles } from "lucide-react";

/** Static placeholder ad slot. In production, swap the inner content for a real ad SDK unit. */
export default function AdBanner() {
  return (
    <div className="flex items-center justify-center gap-2 h-9 bg-gradient-to-l from-brand/30 via-bg-panel2 to-brand/30 border-t border-bg-border text-[11px] text-neutral-400">
      <Sparkles size={12} className="text-brand-light" />
      <span>מקום פרסומי · Mifga Ads</span>
    </div>
  );
}

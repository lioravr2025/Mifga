import { User, Users, MapPin, Navigation } from "lucide-react";
import clsx from "clsx";
import { trackClick } from "../lib/analytics";
import type { TabId } from "../App";

// Order here is right-to-left visually (RTL row): ראשי sits rightmost, then
// מסלול, חברים, פרופיל reading leftward - per product request.
const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "map", label: "ראשי", icon: MapPin },
  { id: "route", label: "מסלול", icon: Navigation },
  { id: "friends", label: "חברים", icon: Users },
  { id: "profile", label: "פרופיל", icon: User },
];

export default function BottomNav({
  tab,
  onChange,
  friendsBadgeCount = 0,
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
  /** pending friend requests + group invites - shown as a "+N" badge on the חברים tab */
  friendsBadgeCount?: number;
}) {
  return (
    <nav className="flex items-stretch justify-around bg-bg-panel border-t border-bg-border px-1 pt-1.5 safe-bottom">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        const badge = id === "friends" ? friendsBadgeCount : 0;
        return (
          <button
            key={id}
            onClick={() => {
              trackClick(`nav_${id}`, "nav");
              onChange(id);
            }}
            className="flex flex-col items-center gap-1 flex-1 py-1.5 relative"
          >
            <span className="relative">
              <Icon size={22} strokeWidth={2.2} className={active ? "text-brand-light" : "text-neutral-500"} />
              {badge > 0 && (
                <span className="absolute -top-1.5 -left-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-bg-panel">
                  {badge > 9 ? "9+" : `+${badge}`}
                </span>
              )}
            </span>
            <span className={clsx("text-[11px] font-medium", active ? "text-brand-light" : "text-neutral-500")}>
              {label}
            </span>
            {active && <span className="absolute -top-1.5 h-1 w-6 rounded-full bg-brand-light" />}
          </button>
        );
      })}
    </nav>
  );
}

import { User, Users, MapPin, Navigation } from "lucide-react";
import clsx from "clsx";
import type { TabId } from "../App";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "profile", label: "פרופיל", icon: User },
  { id: "friends", label: "חברים", icon: Users },
  { id: "map", label: "מפה", icon: MapPin },
  { id: "route", label: "מסלול", icon: Navigation },
];

export default function BottomNav({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="flex items-stretch justify-around bg-bg-panel border-t border-bg-border px-1 pt-1.5 safe-bottom">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="flex flex-col items-center gap-1 flex-1 py-1.5 relative"
          >
            <Icon size={22} strokeWidth={2.2} className={active ? "text-brand-light" : "text-neutral-500"} />
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

import { Calendar, ChevronLeft, Settings, ShoppingBag, X } from "lucide-react";
import { useApp } from "../context/AppContext";

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onOpenMarketplace: () => void;
  onOpenMeetups: () => void;
  onOpenSettings: () => void;
}

export default function SideMenu({ open, onClose, onEditProfile, onOpenMarketplace, onOpenMeetups, onOpenSettings }: SideMenuProps) {
  const { user } = useApp();

  if (!open) return null;

  const go = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div className="absolute inset-0 z-[2600] flex">
      {/* DOM order matters here, not just visual position: this app is RTL
          (dir="rtl" on <html>), so in a flex row the FIRST child renders on
          the right edge - the drawer must come before the backdrop button to
          actually pin to the right, next to the hamburger button in TopBar. */}
      <div className="w-[78%] max-w-xs h-full bg-bg-panel border-s border-bg-border flex flex-col safe-top animate-slideInRight">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-base font-bold text-neutral-50">תפריט</span>
          <button onClick={onClose} className="text-neutral-400">
            <X size={20} />
          </button>
        </div>

        <button
          onClick={() => go(onEditProfile)}
          className="flex items-center gap-3 px-5 py-4 border-b border-bg-border active:bg-bg-panel2 transition"
        >
          <span className="w-12 h-12 rounded-full bg-bg-panel2 border border-bg-border flex items-center justify-center overflow-hidden text-2xl shrink-0">
            {user.avatarPhoto ? <img src={user.avatarPhoto} alt="" className="w-full h-full object-cover" /> : user.avatarEmoji}
          </span>
          <div className="flex-1 min-w-0 text-right">
            <div className="text-sm font-bold text-neutral-50 truncate">{user.name}</div>
            <div className="text-xs text-brand-light font-semibold">עריכת פרופיל</div>
          </div>
          <ChevronLeft size={16} className="text-neutral-500 shrink-0" />
        </button>

        <div className="flex-1 overflow-y-auto no-scrollbar py-2">
          <button onClick={() => go(onOpenMarketplace)} className="w-full flex items-center gap-3 px-5 py-3.5 active:bg-bg-panel2 transition">
            <span className="w-9 h-9 rounded-full bg-bg-panel2 border border-bg-border flex items-center justify-center shrink-0">
              <ShoppingBag size={16} className="text-brand-light" />
            </span>
            <span className="text-sm font-semibold text-neutral-100">מכירה וקנייה</span>
          </button>

          <button onClick={() => go(onOpenMeetups)} className="w-full flex items-center gap-3 px-5 py-3.5 active:bg-bg-panel2 transition">
            <span className="w-9 h-9 rounded-full bg-bg-panel2 border border-bg-border flex items-center justify-center shrink-0">
              <Calendar size={16} className="text-brand-light" />
            </span>
            <span className="text-sm font-semibold text-neutral-100">מפגשים</span>
          </button>

          <button onClick={() => go(onOpenSettings)} className="w-full flex items-center gap-3 px-5 py-3.5 active:bg-bg-panel2 transition">
            <span className="w-9 h-9 rounded-full bg-bg-panel2 border border-bg-border flex items-center justify-center shrink-0">
              <Settings size={16} className="text-brand-light" />
            </span>
            <span className="text-sm font-semibold text-neutral-100">הגדרות</span>
          </button>
        </div>
      </div>

      <button onClick={onClose} className="flex-1 bg-black/60 backdrop-blur-sm animate-fadeIn" aria-label="סגירה" />
    </div>
  );
}

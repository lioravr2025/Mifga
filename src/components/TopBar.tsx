import { Menu, Bell } from "lucide-react";
import ScooterIcon from "./ScooterIcon";

export default function TopBar({
  onMenu,
  onBell,
  onFriendsInMotion,
  friendsInMotionCount,
  notifDot,
}: {
  onMenu: () => void;
  onBell: () => void;
  onFriendsInMotion: () => void;
  friendsInMotionCount: number;
  notifDot?: boolean;
}) {
  return (
    <div className="absolute top-0 inset-x-0 z-[500] flex items-center justify-between px-4 pt-3 safe-top pointer-events-none">
      <button
        onClick={onMenu}
        className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-2xl bg-bg-panel/90 backdrop-blur border border-bg-border shadow-lg active:scale-95 transition"
      >
        <Menu size={20} className="text-neutral-200" />
      </button>

      <button
        onClick={onFriendsInMotion}
        className="pointer-events-auto relative flex items-center gap-1.5 px-3 h-11 rounded-2xl bg-bg-panel/90 backdrop-blur border border-bg-border shadow-lg active:scale-95 transition"
        title="חברים בתנועה בקרבתך"
      >
        <ScooterIcon size={19} color="#a78bfa" />
        <span className="text-sm font-bold text-neutral-100">{friendsInMotionCount}</span>
      </button>

      <button
        onClick={onBell}
        className="pointer-events-auto relative flex items-center justify-center w-11 h-11 rounded-2xl bg-bg-panel/90 backdrop-blur border border-bg-border shadow-lg active:scale-95 transition"
      >
        <Bell size={20} className="text-neutral-200" />
        {notifDot && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500" />}
      </button>
    </div>
  );
}

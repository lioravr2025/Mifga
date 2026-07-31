import { Siren } from "lucide-react";
import ScooterIcon from "./ScooterIcon";

/** Boot-time loading screen: a scooter rides across the screen, hops over a pothole, then spins around next to a police icon - loops until the app is ready. */
export default function LoadingScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-bg px-6">
      <div className="relative w-full h-28 max-w-xs">
        {/* the road */}
        <div className="absolute bottom-2 inset-x-0 h-0.5 bg-bg-border" />

        {/* pothole, fixed along the road at ~45% - the scooter's jump keyframe is timed to clear it */}
        <div
          className="absolute bottom-1.5 w-5 h-2.5 rounded-full border border-hazard-pothole/70"
          style={{ left: "44%", background: "rgba(168,85,247,0.15)" }}
        />

        {/* police icon, fixed along the road at ~82% - the scooter spins around next to it */}
        <div
          className="absolute bottom-0 flex items-center justify-center w-9 h-9 rounded-full"
          style={{ left: "80%", background: "#0f1830", border: "2px solid #38bdf8", boxShadow: "0 0 14px -2px #38bdf8" }}
        >
          <Siren size={16} className="text-[#38bdf8]" />
        </div>

        <div className="absolute bottom-0 animate-scooterMoveX">
          <div className="animate-scooterMotion">
            <ScooterIcon size={30} color="#a78bfa" />
          </div>
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-neutral-50 mb-1" dir="ltr">
          Mifga
        </h1>
        <p className="text-xs font-semibold text-brand-light mb-3">האפליקציה של רוכבי הכלים החשמליים</p>
        <p className="text-sm font-semibold text-neutral-200 mb-1">טוען את האפליקציה...</p>
        <p className="text-xs text-neutral-500">תכף מתחילים לנסוע בטוח</p>
      </div>
    </div>
  );
}

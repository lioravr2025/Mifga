import { Shield, Construction, Siren } from "lucide-react";
import ScooterIcon from "./ScooterIcon";

/**
 * Boot-time loading screen ("radar scan" concept, v2) - a neon night-ride HUD:
 * pulsing radar rings + a perspective road grid in the background, the MIFGA
 * wordmark in a violet->cyan->magenta glow, and a scooter running a lane past
 * the same three hazard icons/colors used for real markers elsewhere in the
 * app (Siren/police, Construction/sidewalk, Shield/inspector) - a preview of
 * what the app actually does, not just decoration.
 */
export default function LoadingScreen() {
  return (
    <div
      className="relative flex-1 flex items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(120% 90% at 50% -10%, #1b0f3d 0%, #12082a 45%, #070312 100%)" }}
    >
      {/* ambient radar rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="absolute w-[60px] h-[60px] rounded-full border border-violet-400/35 animate-radarPulse [animation-delay:0s]" />
        <span className="absolute w-[60px] h-[60px] rounded-full border border-violet-400/35 animate-radarPulse [animation-delay:1.2s]" />
        <span className="absolute w-[60px] h-[60px] rounded-full border border-violet-400/35 animate-radarPulse [animation-delay:2.4s]" />
      </div>

      {/* perspective road grid */}
      <div
        className="absolute inset-x-0 bottom-0 h-[46%] animate-gridDrift opacity-80"
        style={{
          backgroundImage:
            "linear-gradient(rgba(168,85,247,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.16) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,.9), transparent)",
          maskImage: "linear-gradient(to top, rgba(0,0,0,.9), transparent)",
          transform: "perspective(320px) rotateX(58deg)",
          transformOrigin: "bottom",
        }}
      />

      <div className="relative z-[2] w-[min(560px,96vw)] flex flex-col items-center gap-8">
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-cyan-400/10 border border-cyan-400/35 text-cyan-300 text-lg font-bold">
          <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_2px_rgba(34,211,238,0.9)] animate-dotBlink" />
          סורק את הדרך שלך
        </div>

        <div className="text-center leading-none">
          <span
            className="block font-black italic -skew-x-6"
            style={{
              fontSize: "clamp(64px, 20vw, 108px)",
              background: "linear-gradient(92deg, #22d3ee 0%, #a855f7 45%, #f472b6 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 0 22px rgba(168,85,247,.55)) drop-shadow(0 0 46px rgba(34,211,238,.25))",
            }}
          >
            MIFGA
          </span>
          <span className="block mt-4 text-lg font-bold text-neutral-50">האפליקציה של רוכבי הכלים החשמליים</span>
        </div>

        {/* the lane: road + hazard blips (same icons/colors as real markers) + running scooter */}
        <div className="relative w-full h-[100px]">
          <div className="absolute inset-x-[6%] bottom-[22px] h-0.5 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-neutral-100/30 to-transparent" />
            <div
              className="absolute inset-0 animate-laneDash"
              style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(244,240,255,.55) 0 10px, transparent 10px 22px)" }}
            />
          </div>

          <div
            className="absolute bottom-[26px] left-[20%] w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm bg-black/70 animate-blipPing [animation-delay:.1s]"
            style={{ border: "2px solid #f43f5e", boxShadow: "0 0 14px -2px #f43f5e" }}
          >
            <Siren size={22} color="#f43f5e" />
          </div>
          <div
            className="absolute bottom-[26px] left-[52%] w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm bg-black/70 animate-blipPing [animation-delay:.9s]"
            style={{ border: "2px solid #facc15", boxShadow: "0 0 14px -2px #facc15" }}
          >
            <Construction size={22} color="#facc15" />
          </div>
          <div
            className="absolute bottom-[26px] left-[80%] w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm bg-black/70 animate-blipPing [animation-delay:1.7s]"
            style={{ border: "2px solid #38bdf8", boxShadow: "0 0 14px -2px #38bdf8" }}
          >
            <Shield size={22} color="#38bdf8" />
          </div>

          <div className="absolute bottom-3 animate-scooterRun">
            <div
              className="absolute right-[38px] top-[14px] w-11 h-0.5 rounded-full bg-gradient-to-r from-transparent to-brand animate-trailFlicker"
              style={{ filter: "drop-shadow(0 0 6px #7c3aed)" }}
            />
            <div className="[transform:scaleX(-1)]">
              <ScooterIcon size={30} color="#a855f7" />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <p className="text-2xl font-bold text-neutral-50">טוען את האפליקציה...</p>
          <div className="relative w-[260px] h-2 rounded-full bg-neutral-100/10 overflow-hidden">
            <div
              className="absolute inset-0 w-2/5 rounded-full animate-barSweep"
              style={{ background: "linear-gradient(90deg, #22d3ee, #a855f7, #f472b6)", boxShadow: "0 0 12px rgba(168,85,247,.7)" }}
            />
          </div>
          <p className="text-lg text-violet-200/70 font-medium">תכף מתחילים לנסוע בטוח</p>
          <p className="text-base text-violet-200/70 font-semibold">
            כמו <b className="text-cyan-300 font-extrabold">WAZE</b>, רק לכלים חשמליים
          </p>
        </div>
      </div>
    </div>
  );
}

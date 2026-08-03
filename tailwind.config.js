/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base app palette - dark navy concept from the design reference
        bg: {
          DEFAULT: "#0b1220",
          panel: "#131c2e",
          panel2: "#1a2438",
          border: "#243250",
        },
        brand: {
          DEFAULT: "#7c3aed",
          light: "#a78bfa",
        },
        hazard: {
          police: "#38bdf8",
          inspector: "#f59e0b",
          pothole: "#a855f7",
          car: "#ef4444",
          sidewalk: "#facc15",
          green: "#22c55e",
        },
      },
      fontFamily: {
        sans: ["Rubik", "Heebo", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -4px var(--tw-shadow-color)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.8" },
          "70%": { transform: "scale(1.8)", opacity: "0" },
          "100%": { transform: "scale(0.9)", opacity: "0" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        popIn: {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        scooterMoveX: {
          "0%": { left: "-12%" },
          "38%": { left: "38%" },
          "50%": { left: "54%" },
          "82%": { left: "78%" },
          "95%": { left: "78%" },
          "100%": { left: "116%" },
        },
        // combines the pothole jump (~36-52%) and the spin-around at the
        // police icon (~80-100%) into one keyframe list, since two separate
        // animations both targeting `transform` would clobber each other
        // instead of composing
        scooterMotion: {
          "0%, 36%, 52%, 80%": { transform: "translateY(0) rotate(0deg) scale(1)" },
          "43%": { transform: "translateY(-26px) rotate(-18deg) scale(1)" },
          "90%": { transform: "translateY(0) rotate(200deg) scale(0.85)" },
          "100%": { transform: "translateY(0) rotate(360deg) scale(1)" },
        },
        // "radar scan" boot screen (LoadingScreen.tsx v2) - scale+opacity only
        // (not width/height) so this stays on the compositor thread instead
        // of forcing a layout reflow on every frame, which was visible as
        // jank/"shaking" on real (lower-end) phones even though it looked
        // smooth in desktop testing.
        radarPulse: {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "70%": { opacity: "0.12" },
          "100%": { transform: "scale(15)", opacity: "0" },
        },
        gridDrift: {
          from: { backgroundPosition: "0 0" },
          to: { backgroundPosition: "0 44px" },
        },
        dotBlink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
        laneDash: {
          to: { transform: "translateX(-32px)" },
        },
        blipPing: {
          "0%, 100%": { transform: "scale(1)" },
          "15%": { transform: "scale(1.22)" },
          "30%": { transform: "scale(1)" },
        },
        // transform, not `left` - same reflow-avoidance reason as radarPulse above
        scooterRun: {
          "0%": { transform: "translateX(-12vw)" },
          "92%": { transform: "translateX(96vw)" },
          "100%": { transform: "translateX(96vw)", opacity: "0" },
        },
        trailFlicker: {
          from: { opacity: "0.4" },
          to: { opacity: "1" },
        },
      },
      animation: {
        pulseRing: "pulseRing 1.8s ease-out infinite",
        slideUp: "slideUp 0.22s ease-out",
        popIn: "popIn 0.18s ease-out",
        fadeIn: "fadeIn 0.18s ease-out",
        slideInRight: "slideInRight 0.22s ease-out",
        scooterMoveX: "scooterMoveX 4.5s cubic-bezier(0.45,0,0.55,1) infinite",
        scooterMotion: "scooterMotion 4.5s ease-in-out infinite",
        radarPulse: "radarPulse 3.6s cubic-bezier(.2,.6,.3,1) infinite",
        gridDrift: "gridDrift 1.6s linear infinite",
        dotBlink: "dotBlink 1.4s ease-in-out infinite",
        laneDash: "laneDash 0.5s linear infinite",
        blipPing: "blipPing 2.6s ease-in-out infinite",
        scooterRun: "scooterRun 2.6s cubic-bezier(.4,0,.2,1) infinite",
        trailFlicker: "trailFlicker 0.3s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [],
};

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
      },
      animation: {
        pulseRing: "pulseRing 1.8s ease-out infinite",
        slideUp: "slideUp 0.22s ease-out",
        popIn: "popIn 0.18s ease-out",
      },
    },
  },
  plugins: [],
};

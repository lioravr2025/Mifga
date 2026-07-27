/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        sans: ["Rubik", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

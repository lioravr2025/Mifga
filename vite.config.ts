import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Mifga - local dev config. host:true so it's reachable from a phone on the
// same wifi for quick mobile-viewport testing before the Capacitor build.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});

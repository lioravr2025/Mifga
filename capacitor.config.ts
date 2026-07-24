import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wraps this same web build for Android (and later iOS) without
// any code changes - `npm run build` then `npx cap sync`. Android build
// itself needs Android Studio / SDK (or a CI runner), same as the
// WhatsApp Secrets project.
const config: CapacitorConfig = {
  appId: "com.mifga.app",
  appName: "Mifga",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;

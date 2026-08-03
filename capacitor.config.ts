import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wraps this same web build for both Android and iOS without any
// code changes - `npm run build` then `npx cap sync`. Android builds via a
// CI runner (no local SDK needed, see .github/workflows/android-build.yml);
// iOS needs an actual Mac + Xcode to sign and install on a real device
// (CI can only do an unsigned Simulator build - see ios-build.yml).
const config: CapacitorConfig = {
  appId: "com.mifga.app",
  appName: "Mifga",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;

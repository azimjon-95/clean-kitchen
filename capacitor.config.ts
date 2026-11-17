import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for native iOS / Android packaging.
 *
 * Install (once, on a machine with Node + native toolchains):
 *   cd apps/client
 *   npm i -D @capacitor/cli @capacitor/core
 *   npm i @capacitor/ios @capacitor/android @capacitor-community/speech-recognition
 *   npx cap init "Clean Kitchen" com.restaurant.cleankitchen
 *   npx cap add ios && npx cap add android
 *   npm run build && npx cap sync
 *
 * Speech plugin:
 *   Uses @capacitor-community/speech-recognition
 *   Free, on-device where the OS provides models.
 *   Client code already prefers native backend via src/lib/speech.ts
 */
const config: CapacitorConfig = {
  appId: "com.restaurant.cleankitchen",
  appName: "Clean Kitchen",
  webDir: "dist",
  server: {
    androidScheme: "https"
  },
  plugins: {
    SpeechRecognition: {
      // community plugin options
    }
  }
};

export default config;

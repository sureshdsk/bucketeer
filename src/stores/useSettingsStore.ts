import { create } from "zustand";

import {
  getAppSettings,
  recordEvent,
  setTelemetryConsent,
  type AppSettings,
  type Consent,
} from "@/lib/ipc";

interface SettingsState {
  settings: AppSettings | null;
  load: () => Promise<void>;
  setConsent: (consent: Consent) => Promise<void>;
  /** Record an anonymous usage event. No-ops unless the user has opted in. */
  track: (kind: string, name: string) => void;
  /** True once settings have loaded and consent is still undecided. */
  needsConsentGate: () => boolean;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  load: async () => {
    try {
      const settings = await getAppSettings();
      set({ settings });
    } catch {
      // Settings are best-effort; never block boot on failure.
    }
  },
  setConsent: async (consent) => {
    const settings = await setTelemetryConsent(consent);
    set({ settings });
  },
  track: (kind, name) => {
    const { settings } = get();
    if (settings?.telemetry_consent !== "accepted") return;
    void recordEvent(kind, name).catch(() => {});
  },
  needsConsentGate: () => {
    const { settings } = get();
    return settings !== null && settings.telemetry_consent === "undecided";
  },
}));

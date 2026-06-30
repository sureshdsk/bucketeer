import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSettingsStore } from "@/stores/useSettingsStore";

/**
 * First-launch telemetry consent gate (P5.5). Shown once, only while consent is
 * `undecided`. Declined sends nothing and logs the decision; accepted enables
 * the local-file sink only — nothing leaves the machine.
 */
export function TelemetryConsentGate() {
  const settings = useSettingsStore((s) => s.settings);
  const setConsent = useSettingsStore((s) => s.setConsent);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (settings && settings.telemetry_consent === "undecided") {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [settings]);

  const decide = (consent: "accepted" | "declined") => {
    void setConsent(consent);
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      onClose={() => decide("declined")}
      title="Help improve Bucketeer"
      description="Anonymous, local-only usage metrics. You can change this any time in Settings."
      showClose={false}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-card border border-outline-variant/60 bg-surface-container-low/50 p-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-inset ring-primary/20">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-on-surface-variant">
            <p>
              We collect coarse, anonymous events — like which actions you use —
              to prioritize improvements.
            </p>
            <p className="text-[12px] text-on-surface-variant/80">
              Events are written locally to your Bucketeer logs folder. Nothing is
              sent off your machine.
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => decide("declined")}>
            Not now
          </Button>
          <Button onClick={() => decide("accepted")}>Allow</Button>
        </div>
      </div>
    </Modal>
  );
}

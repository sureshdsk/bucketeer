import {
  CheckCircle2,
  Copy,
  Database,
  Download,
  Info,
  Loader2,
  type LucideIcon,
  Palette,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  clearCache,
  exportDiagnostics,
  getAppInfo,
  getAppPaths,
  type AppInfo,
  type AppPaths,
} from "@/lib/ipc";
import { checkForUpdates, downloadAndInstall, type UpdateStatus } from "@/lib/updater";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useThemeStore, type Theme } from "@/stores/useThemeStore";

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const settings = useSettingsStore((s) => s.settings);
  const setConsent = useSettingsStore((s) => s.setConsent);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      description="Appearance, data, privacy, and updates."
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-7">
        <AppearanceSection theme={theme} onTheme={setTheme} />
        <DataSection />
        <UpdatesSection />
        <PrivacySection
          consent={settings?.telemetry_consent ?? "undecided"}
          onConsent={(c) => void setConsent(c)}
        />
        <AboutSection />
      </div>
    </Modal>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-container-high text-on-surface-variant">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-tight text-on-surface">
            {title}
          </h3>
          {description ? (
            <p className="text-[11.5px] text-on-surface-variant">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="rounded-card border border-outline-variant/60 bg-card/40 p-card_padding_lg">
        {children}
      </div>
    </section>
  );
}

function AppearanceSection({
  theme,
  onTheme,
}: {
  theme: Theme;
  onTheme: (t: Theme) => void;
}) {
  return (
    <Section
      icon={Palette}
      title="Appearance"
      description="Theme follows your system by default."
    >
      <div className="flex items-center justify-between gap-4">
        <div className="text-[13px] text-on-surface">
          Theme
        </div>
        <Select<Theme>
          value={theme}
          onValueChange={onTheme}
          aria-label="Theme"
          options={[
            { value: "system", label: "Match system" },
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(["system", "dark", "light"] as const).map((t) => (
          <ThemeSwatch
            key={t}
            value={t}
            active={theme === t}
            onClick={() => onTheme(t)}
          />
        ))}
      </div>
    </Section>
  );
}

function ThemeSwatch({
  value,
  active,
  onClick,
}: {
  value: Theme;
  active: boolean;
  onClick: () => void;
}) {
  const labels: Record<Theme, string> = {
    system: "System",
    dark: "Dark",
    light: "Light",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-md border p-2.5 transition-colors duration-fast",
        active
          ? "border-primary/40 bg-primary/5 ring-1 ring-inset ring-primary/20"
          : "border-outline-variant/60 bg-surface-container-low/40 hover:border-outline-variant",
      )}
    >
      <span
        className={cn(
          "h-8 w-full rounded-md border",
          value === "light"
            ? "border-outline bg-gradient-to-br from-neutral-100 to-neutral-300"
            : value === "dark"
              ? "border-outline bg-gradient-to-br from-neutral-800 to-neutral-950"
              : "border-outline bg-gradient-to-r from-neutral-100 via-neutral-500 to-neutral-950",
        )}
      />
      <span className="text-[11px] font-medium text-on-surface-variant">
        {labels[value]}
      </span>
    </button>
  );
}

function DataSection() {
  const push = useNotificationStore((s) => s.push);
  const [paths, setPaths] = useState<AppPaths | null>(null);
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void getAppPaths().then(setPaths).catch(() => {});
  }, []);

  const onClear = async () => {
    setClearing(true);
    try {
      await clearCache();
      push({ kind: "success", title: "Cache cleared", body: "Cached clients were reset." });
    } catch {
      push({ kind: "error", title: "Could not clear cache" });
    } finally {
      setClearing(false);
    }
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const path = await exportDiagnostics();
      push({
        kind: "success",
        title: "Diagnostics exported",
        body: path,
      });
    } catch {
      push({ kind: "error", title: "Could not export diagnostics" });
    } finally {
      setExporting(false);
    }
  };

  const rows: Array<[string, string | null]> = [
    ["Config", paths?.config ?? null],
    ["Logs", paths?.logs ?? null],
    ["Cache", paths?.cache ?? null],
  ];

  return (
    <Section
      icon={Database}
      title="Data & cache"
      description="Where Bucketeer stores preferences, logs, and cached responses."
    >
      <div className="flex flex-col">
        {rows.map(([label, value]) => (
          <PathRow key={label} label={label} value={value} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          loading={clearing}
          onClick={() => void onClear()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Clear cache
        </Button>
        <Button
          variant="outline"
          size="sm"
          loading={exporting}
          onClick={() => void onExport()}
        >
          <Download className="h-3.5 w-3.5" />
          Export diagnostics
        </Button>
      </div>
    </Section>
  );
}

function PathRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="group flex items-center justify-between gap-2 border-b border-outline-variant/30 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
          {label}
        </div>
        <div className="mt-0.5 truncate font-mono text-data-mono text-[12px] text-on-surface">
          {value ?? "—"}
        </div>
      </div>
      {value ? (
        <button
          type="button"
          title="Copy path"
          onClick={() => void navigator.clipboard.writeText(value)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-on-surface-variant opacity-0 transition-opacity duration-instant hover:bg-surface-container hover:text-on-surface group-hover:opacity-100"
        >
          <Copy className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function UpdatesSection() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);

  const check = async () => {
    setChecking(true);
    try {
      setStatus(await checkForUpdates());
    } finally {
      setChecking(false);
    }
  };

  const install = async () => {
    setInstalling(true);
    setProgress(0);
    try {
      await downloadAndInstall(setProgress);
    } catch {
      setInstalling(false);
    }
  };

  return (
    <Section
      icon={RefreshCw}
      title="Updates"
      description="Check for and install the latest release."
    >
      <div className="flex items-center justify-between gap-3">
        <UpdateLabel checking={checking} status={status} progress={progress} installing={installing} />
        {status?.available ? (
          <Button size="sm" loading={installing} onClick={() => void install()}>
            {installing ? "Installing…" : `Install ${status.version}`}
          </Button>
        ) : (
          <Button size="sm" loading={checking} onClick={() => void check()}>
            Check for updates
          </Button>
        )}
      </div>
      {status?.error ? (
        <p className="mt-2 text-[11.5px] text-destructive">{status.error}</p>
      ) : null}
    </Section>
  );
}

function UpdateLabel({
  checking,
  status,
  progress,
  installing,
}: {
  checking: boolean;
  status: UpdateStatus | null;
  progress: number;
  installing: boolean;
}) {
  if (checking) {
    return (
      <span className="flex items-center gap-2 text-[12.5px] text-on-surface-variant">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
      </span>
    );
  }
  if (installing) {
    return (
      <span className="flex items-center gap-2 text-[12.5px] text-on-surface-variant">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Downloading {Math.round(progress * 100)}%
      </span>
    );
  }
  if (!status) {
    return <span className="text-[12.5px] text-on-surface-variant">Not checked yet</span>;
  }
  if (status.available) {
    return (
      <span className="flex items-center gap-2 text-[12.5px] text-on-surface">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        v{status.version} is available (current: v{status.currentVersion || "?"})
      </span>
    );
  }
  return (
    <span className="text-[12.5px] text-on-surface-variant">
      You're on the latest version{status.currentVersion ? ` (v${status.currentVersion})` : ""}
    </span>
  );
}

function PrivacySection({
  consent,
  onConsent,
}: {
  consent: "undecided" | "accepted" | "declined";
  onConsent: (c: "accepted" | "declined") => void;
}) {
  const optedIn = consent === "accepted";
  return (
    <Section
      icon={ShieldCheck}
      title="Privacy"
      description="Anonymous, local-only usage metrics."
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 text-[12.5px] leading-relaxed text-on-surface-variant">
          <span className="font-medium text-on-surface">Anonymous usage metrics</span>
          <span className="text-[11.5px] text-on-surface-variant/85">
            Coarse events are written to your local logs only. Nothing is sent
            off your machine.
          </span>
        </div>
        <Switch
          checked={optedIn}
          onCheckedChange={(c) => onConsent(c ? "accepted" : "declined")}
          aria-label="Anonymous usage metrics"
        />
      </div>
      <p className="mt-2 text-[11px] text-on-surface-variant/70">
        Current status:{" "}
        <span className="font-medium text-on-surface-variant">
          {consent === "accepted"
            ? "Opted in"
            : consent === "declined"
              ? "Opted out"
              : "Not decided"}
        </span>
      </p>
    </Section>
  );
}

function AboutSection() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    void getAppInfo().then(setInfo).catch(() => {});
  }, []);
  return (
    <Section icon={Info} title="About">
      <div className="flex flex-col gap-1.5 text-[12.5px]">
        <Row label="App" value={info ? `Bucketeer v${info.version}` : "Bucketeer"} />
        <Row label="Platform" value={info ? `${info.os} · ${info.arch}` : "—"} />
      </div>
    </Section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-on-surface-variant">{label}</span>
      <span className="font-mono text-data-mono text-on-surface">{value}</span>
    </div>
  );
}

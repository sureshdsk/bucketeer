import { Moon, Search, Settings, Sun } from "lucide-react";

import { NetworkActivityButton } from "@/components/layout/NetworkActivityButton";
import { NotificationsButton } from "@/components/layout/NotificationsButton";
import { WorkspaceTabs } from "@/components/layout/WorkspaceTabs";
import { TransferIndicator } from "@/components/explorer/TransferDrawer";
import { Avatar } from "@/components/ui/avatar";
import { useBucketStore } from "@/stores/useBucketStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { useTransferStore } from "@/stores/useTransferStore";

interface TopAppBarProps {
  onOpenPicker?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenSettings?: () => void;
}

export function TopAppBar({
  onOpenPicker,
  onOpenCommandPalette,
  onOpenSettings,
}: TopAppBarProps) {
  const setTransferDrawerOpen = useTransferStore((s) => s.setDrawerOpen);
  const transferDrawerOpen = useTransferStore((s) => s.drawerOpen);
  const resolved = useThemeStore((s) => s.resolved);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const active = useBucketStore((s) => s.active);

  return (
    <header className="flex h-chrome_height shrink-0 items-center gap-2 border-b border-outline-variant/60 bg-background pl-2.5 pr-2.5">
      <div className="min-w-0 flex-1 overflow-hidden">
        <WorkspaceTabs />
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-pill border border-outline-variant/50 bg-card/60 px-1 py-1 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          title="Search · ⌘K"
          className="flex h-7 items-center gap-2 rounded-full px-2.5 text-xs text-on-surface-variant transition-colors duration-instant hover:bg-surface-container-high hover:text-on-surface"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-[11px]">Search</span>
          <kbd className="rounded bg-surface-container-high px-1 font-mono text-[10px] text-on-surface-variant/80">
            ⌘K
          </kbd>
        </button>
        <TransferIndicator onToggle={() => setTransferDrawerOpen(!transferDrawerOpen)} />
        <NetworkActivityButton />
        <NotificationsButton />
        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-instant hover:bg-surface-container-high hover:text-on-surface"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          title={resolved === "light" ? "Switch to dark" : "Switch to light"}
          aria-label="Toggle theme"
          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-instant hover:bg-surface-container-high hover:text-on-surface"
        >
          {resolved === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onOpenPicker}
          title="Switch bucket"
          className="ml-0.5"
        >
          <Avatar name={active?.name ?? "DS"} size="md" />
        </button>
      </div>
    </header>
  );
}

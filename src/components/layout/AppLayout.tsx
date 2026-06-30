import { GlobalProgress } from "./GlobalProgress";
import { SideNav } from "./SideNav";
import { TopAppBar } from "./TopAppBar";
import type { Bucket } from "@/lib/ipc";

export function AppLayout({
  children,
  onOpenPicker,
  onAddBucket,
  onEditBucket,
  onDeleteBucket,
  onManageBuckets,
  onOpenCommandPalette,
  onOpenSettings,
}: {
  children: React.ReactNode;
  onOpenPicker?: () => void;
  onAddBucket?: () => void;
  onEditBucket?: (b: Bucket) => void;
  onDeleteBucket?: (b: Bucket) => void;
  onManageBuckets?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenSettings?: () => void;
}) {
  return (
    <div className="relative flex h-full w-full overflow-hidden bg-background text-on-surface">
      <GlobalProgress />
      <SideNav
        onAddBucket={onAddBucket}
        onEditBucket={onEditBucket}
        onDeleteBucket={onDeleteBucket}
        onManageBuckets={onManageBuckets}
      />
      <div className="relative flex min-w-0 flex-1 flex-col border-l border-outline-variant/60 shadow-[inset_4px_0_12px_-8px_rgba(0,0,0,0.18)]">
        <TopAppBar
          onOpenPicker={onOpenPicker}
          onOpenCommandPalette={onOpenCommandPalette}
          onOpenSettings={onOpenSettings}
        />
        <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

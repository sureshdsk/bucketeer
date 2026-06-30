import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { RecentBucketsGrid } from "@/components/dashboard/RecentBucketsGrid";
import type { Bucket } from "@/lib/ipc";

export interface DashboardProps {
  onAddBucket?: () => void;
  onEditBucket?: (b: Bucket) => void;
  onDeleteBucket?: (b: Bucket) => void;
  onManageBuckets?: () => void;
  onOpenPalette?: () => void;
}

export function Dashboard({
  onAddBucket,
  onEditBucket,
  onDeleteBucket,
  onManageBuckets,
  onOpenPalette,
}: DashboardProps) {
  return (
    <div className="h-full overflow-y-auto p-card_padding_lg">
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <HeroCard onAddBucket={onAddBucket} />
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <RecentBucketsGrid
            onAddBucket={onAddBucket}
            onEditBucket={onEditBucket}
            onDeleteBucket={onDeleteBucket}
            onManageBuckets={onManageBuckets}
          />
          <QuickActionsCard onAddBucket={onAddBucket} onOpenPalette={onOpenPalette} />
        </div>
        <ActivityCard />
      </div>
    </div>
  );
}

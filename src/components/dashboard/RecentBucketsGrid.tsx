import { Database, Settings2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { BucketCard, EmptyBucketCard } from "@/components/dashboard/BucketCard";
import { useBucketStore } from "@/stores/useBucketStore";
import { openTarget } from "@/lib/navigation";
import type { Bucket } from "@/lib/ipc";

export function RecentBucketsGrid({
  onAddBucket,
  onEditBucket,
  onDeleteBucket,
  onManageBuckets,
}: {
  onAddBucket?: () => void;
  onEditBucket?: (b: Bucket) => void;
  onDeleteBucket?: (b: Bucket) => void;
  onManageBuckets?: () => void;
}) {
  const buckets = useBucketStore((s) => s.buckets);
  const configs = buckets.filter((p) => p.bucket);

  return (
    <Card className="animate-card-enter stagger-2 flex flex-col gap-3 p-card_padding_lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-on-surface-variant/70" />
          <h2 className="text-headline-sm font-semibold tracking-tight text-on-surface">
            Your buckets
          </h2>
          {configs.length > 0 ? (
            <span className="rounded-full bg-surface-container-high px-1.5 py-px text-[9.5px] font-semibold text-on-surface-variant">
              {configs.length}
            </span>
          ) : null}
        </div>
        {configs.length > 0 ? (
          <button
            type="button"
            onClick={() => onManageBuckets?.()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-on-surface-variant transition-colors duration-instant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Settings2 className="h-3.5 w-3.5" /> Manage
          </button>
        ) : null}
      </div>
      {configs.length === 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <EmptyBucketCard onClick={onAddBucket} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {configs.map((c, i) => (
            <BucketCard
              key={c.id}
              bucket={c}
              index={i}
              onClick={() => void openTarget(c.id, c.bucket!, c.prefix ?? "")}
              onEdit={onEditBucket ? () => onEditBucket(c) : undefined}
              onDelete={onDeleteBucket ? () => onDeleteBucket(c) : undefined}
            />
          ))}
          <EmptyBucketCard onClick={onAddBucket} />
        </div>
      )}
    </Card>
  );
}

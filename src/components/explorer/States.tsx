import { FolderOpen, Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full animate-fade-content flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-card-lg bg-tint-blue text-tint-on-blue">
        <FolderOpen className="h-7 w-7" />
      </div>
      <p className="max-w-sm text-[13px] leading-relaxed text-on-surface-variant">
        {message}
      </p>
    </div>
  );
}

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex h-full animate-fade-content items-center justify-center gap-2.5 text-on-surface-variant">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span className="text-[13px]">{message}</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full animate-fade-content flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-card-lg bg-tint-rose text-tint-on-rose">
        <TriangleAlert className="h-7 w-7" />
      </div>
      <p className="max-w-md break-words font-mono text-data-mono text-on-surface-variant">
        {message}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function NoBucketSelected() {
  return (
    <div className="flex h-full animate-fade-content flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-card-lg bg-tint-blue text-tint-on-blue">
        <FolderOpen className="h-7 w-7" />
      </div>
      <p className="max-w-sm text-[13px] leading-relaxed text-on-surface-variant">
        Select a bucket from the sidebar or open a path directly.
      </p>
    </div>
  );
}

export function SkeletonTable({ rows = 14 }: { rows?: number }) {
  return (
    <div className="flex h-full animate-fade-content flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-outline-variant/60 bg-surface-container-low/60">
        <div className="w-10 px-3">
          <Skeleton className="h-3.5 w-3.5 rounded-sm" />
        </div>
        <div className="flex-1 px-2">
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="w-28 px-2">
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
        <div className="w-44 px-2">
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="w-32 px-2">
          <Skeleton className="h-3 w-16 rounded-full" />
        </div>
      </div>
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex h-table_row items-center border-b border-outline-variant/15"
          >
            <div className="w-10 px-3">
              <Skeleton className="h-3.5 w-3.5 rounded-sm" />
            </div>
            <div className="flex-1 px-2">
              <Skeleton
                className="h-3"
                style={{ width: `${28 + ((i * 37) % 52)}%` }}
              />
            </div>
            <div className="w-28 px-2">
              <Skeleton className="ml-auto h-3 w-12" />
            </div>
            <div className="w-44 px-2">
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="w-32 px-2">
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

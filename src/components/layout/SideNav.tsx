import { Cloud, Database, Pencil, Plus, Settings2, Trash2 } from "lucide-react";

import { useExplorerStore } from "@/stores/useExplorerStore";
import { useBucketStore } from "@/stores/useBucketStore";
import { SavedLocations } from "@/components/layout/SavedLocations";
import { openTarget } from "@/lib/navigation";
import type { Bucket } from "@/lib/ipc";
import { cn } from "@/lib/utils";

export function SideNav({
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
  const active = useBucketStore((s) => s.active);
  const buckets = useBucketStore((s) => s.buckets);
  const activeBucket = useExplorerStore((s) => s.bucket);

  const configs = buckets.filter((p) => p.bucket);

  return (
    <aside className="flex h-full w-sidebar_width shrink-0 flex-col border-r border-outline-variant/60 bg-surface-dim">
      <div className="flex h-chrome_height shrink-0 items-center gap-2.5 border-b border-outline-variant/60 px-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-card bg-primary/15 ring-1 ring-inset ring-primary/20 text-primary">
          <Cloud className="h-4 w-4" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-[13px] font-semibold tracking-tight text-on-surface">
            Bucketeer
          </div>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2.5 py-3">
        <section>
          <div className="flex items-center justify-between px-1 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
                Buckets
              </span>
              {configs.length > 0 ? (
                <span className="rounded-full bg-surface-container-high px-1.5 py-px text-[9.5px] font-semibold text-on-surface-variant">
                  {configs.length}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-0.5">
              {configs.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onManageBuckets?.()}
                  aria-label="Manage buckets"
                  title="Manage buckets"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onAddBucket?.()}
                aria-label="Add bucket"
                title="Add bucket"
                className="flex h-6 w-6 items-center justify-center rounded-md text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {configs.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {configs.map((c) => {
                const isActive = active?.id === c.id && activeBucket === c.bucket;
                return (
                  <li key={c.id}>
                    <div className="group flex items-center">
                      <button
                        type="button"
                        onClick={() => void openTarget(c.id, c.bucket!, c.prefix ?? "")}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2.5 rounded-card border px-2.5 py-2 text-left transition-[background-color,border-color,box-shadow] duration-base ease-out-soft",
                          isActive
                            ? "border-primary/30 bg-primary/10 shadow-sm"
                            : "border-transparent bg-transparent hover:border-outline-variant/60 hover:bg-card hover:shadow-card",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                            isActive
                              ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/20"
                              : "bg-surface-container-high text-on-surface-variant group-hover:text-primary",
                          )}
                        >
                          <Database className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-on-surface">
                            {c.name}
                          </span>
                          <span className="block truncate font-mono text-data-mono text-[10.5px] text-on-surface-variant/80">
                            s3://{c.bucket}
                            {c.prefix ? `/${c.prefix}` : ""}
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center pr-0.5 opacity-0 transition-opacity duration-instant group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label="Edit bucket"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditBucket?.(c);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded text-on-surface-variant transition-colors duration-instant hover:bg-surface-container hover:text-on-surface"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete bucket"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteBucket?.(c);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded text-on-surface-variant transition-colors duration-instant hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-2.5 rounded-card border border-dashed border-outline-variant/60 bg-card/40 p-3">
              <p className="text-[12px] leading-snug text-on-surface-variant">
                No buckets yet. Add one to get started.
              </p>
              <button
                type="button"
                onClick={() => onAddBucket?.()}
                className="flex items-center gap-1.5 rounded-md border border-outline-variant/70 bg-card px-2.5 py-1.5 text-[12px] font-medium text-on-surface transition-colors duration-instant hover:border-outline hover:bg-surface-container-low"
              >
                <Plus className="h-3.5 w-3.5" /> Add bucket
              </button>
            </div>
          )}
        </section>

        <SavedLocations />
      </nav>
    </aside>
  );
}

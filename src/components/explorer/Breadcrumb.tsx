import { ChevronLeft, ChevronRight, Copy } from "lucide-react";

import {
  breadcrumbSegments,
  useExplorerStore,
} from "@/stores/useExplorerStore";
import { cn } from "@/lib/utils";

export function Breadcrumb() {
  const bucket = useExplorerStore((s) => s.bucket);
  const prefix = useExplorerStore((s) => s.prefix);
  const navigateToSegment = useExplorerStore((s) => s.navigateToSegment);

  const segments = breadcrumbSegments(bucket, prefix);
  if (segments.length === 0) {
    return (
      <div className="text-[13px] text-on-surface-variant">
        No bucket selected
      </div>
    );
  }

  const canGoUp = segments.length > 1;
  const upIndex = segments.length - 2;

  const copySegment = (index: number) => {
    const path = segments.slice(0, index + 1).join("/");
    void navigator.clipboard.writeText(path + (index === 0 ? "" : "/"));
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        onClick={() => canGoUp && void navigateToSegment(upIndex)}
        disabled={!canGoUp}
        aria-label="Up one level"
        title={canGoUp ? "Up one level" : "Already at bucket root"}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-pill border transition-colors duration-instant",
          canGoUp
            ? "border-outline-variant/60 bg-card text-on-surface-variant hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            : "cursor-default border-transparent text-on-surface-variant/30",
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          return (
            <div key={`${seg}-${i}`} className="flex shrink-0 items-center">
              {i > 0 ? (
                <ChevronRight className="mx-0.5 h-3.5 w-3.5 shrink-0 text-on-surface-variant/40" />
              ) : null}
              <button
                type="button"
                onClick={() => void navigateToSegment(i)}
                className={cn(
                  "group flex items-center gap-1 rounded-pill border px-2.5 py-1 font-mono text-data-mono transition-colors duration-instant",
                  isLast
                    ? "border-primary/30 bg-primary/10 font-semibold text-primary"
                    : "border-transparent text-on-surface hover:border-outline-variant/60 hover:bg-card",
                )}
              >
                {seg}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    copySegment(i);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      copySegment(i);
                    }
                  }}
                  className="cursor-pointer opacity-0 transition-opacity duration-instant group-hover:opacity-100"
                  title="Copy path"
                >
                  <Copy className="h-3 w-3 text-on-surface-variant" />
                </span>
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

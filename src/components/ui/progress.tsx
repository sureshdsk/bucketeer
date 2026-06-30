import { cn } from "@/lib/utils";

export interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  indicatorClassName?: string;
  "aria-label"?: string;
}

export function Progress({
  value,
  max = 100,
  className,
  indicatorClassName,
  "aria-label": ariaLabel,
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(value, max));
  const pct = max === 0 ? 0 : (clamped / max) * 100;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-label={ariaLabel}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-base ease-out-soft",
          indicatorClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function IndeterminateProgress({
  className,
  "aria-label": ariaLabel,
}: {
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high",
        className,
      )}
    >
      <div className="loading-bar-segment absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary" />
    </div>
  );
}

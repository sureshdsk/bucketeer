import { cn } from "@/lib/utils";

export interface LoadingBarProps {
  active: boolean;
  className?: string;
}

export function LoadingBar({ active, className }: LoadingBarProps) {
  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-40 h-[2px] overflow-hidden bg-primary/20",
        className,
      )}
    >
      <div className="loading-bar-segment h-full w-1/4 rounded-full bg-primary" />
    </div>
  );
}

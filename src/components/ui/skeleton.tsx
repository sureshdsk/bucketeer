import { cn } from "@/lib/utils";

type SkeletonVariant = "text" | "rect" | "card" | "avatar" | "stat-grid";

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

export function Skeleton({
  className,
  variant = "rect",
  ...props
}: SkeletonProps) {
  if (variant === "card") {
    return (
      <div
        className={cn(
          "rounded-card border border-outline-variant/60 bg-card p-card_padding_lg",
          className,
        )}
        {...props}
      >
        <div className="skeleton mb-3 h-4 w-1/3 rounded-md" />
        <div className="skeleton mb-2 h-3 w-full rounded-md" />
        <div className="skeleton mb-2 h-3 w-4/5 rounded-md" />
        <div className="skeleton h-3 w-2/3 rounded-md" />
      </div>
    );
  }
  if (variant === "stat-grid") {
    return (
      <div className={cn("grid grid-cols-2 gap-2", className)} {...props}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-md border border-outline-variant/60 bg-card p-3"
          >
            <div className="skeleton mb-2 h-2.5 w-1/2 rounded-md" />
            <div className="skeleton h-4 w-3/4 rounded-md" />
          </div>
        ))}
      </div>
    );
  }
  if (variant === "avatar") {
    return (
      <div
        className={cn("skeleton rounded-full", "h-8 w-8", className)}
        {...props}
      />
    );
  }
  return (
    <div
      className={cn(
        "skeleton rounded-md",
        variant === "text" && "h-3.5",
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton variant="card" className={className} {...props} />;
}

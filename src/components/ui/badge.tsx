import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide transition-colors",
  {
    variants: {
      variant: {
        private: "border-outline-variant text-on-surface-variant",
        public:
          "border-transparent bg-error-container/70 text-on-error-container",
        encrypted:
          "border-transparent bg-secondary-fixed-dim/15 text-secondary-fixed-dim",
        outline: "border-outline-variant text-on-surface-variant",
        "tint-blue": "border-transparent bg-tint-blue text-tint-on-blue",
        "tint-amber": "border-transparent bg-tint-amber text-tint-on-amber",
        "tint-green": "border-transparent bg-tint-green text-tint-on-green",
        "tint-rose": "border-transparent bg-tint-rose text-tint-on-rose",
        "tint-violet": "border-transparent bg-tint-violet text-tint-on-violet",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };

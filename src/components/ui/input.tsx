import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: LucideIcon;
  trailing?: React.ReactNode;
}

const baseInputCls =
  "h-10 w-full rounded-md border border-outline-variant bg-card px-3 text-[13px] text-on-surface placeholder:text-on-surface-variant/70 transition-[border-color,box-shadow,background-color] duration-fast ease-out-soft focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-45";

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type = "text", leadingIcon: Icon, trailing, ...props },
    ref,
  ) => {
    if (!Icon && !trailing) {
      return (
        <input
          ref={ref}
          type={type}
          className={cn(baseInputCls, className)}
          {...props}
        />
      );
    }
    return (
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/70" />
        ) : null}
        <input
          ref={ref}
          type={type}
          className={cn(
            baseInputCls,
            Icon && "pl-9",
            trailing && "pr-9",
            className,
          )}
          {...props}
        />
        {trailing ? (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            {trailing}
          </div>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

export const inputCls = baseInputCls;

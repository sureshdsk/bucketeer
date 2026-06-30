import { X } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";
import { usePresence } from "@/lib/use-presence";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "center" | "sheet";
  showClose?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  variant = "center",
  showClose = true,
}: ModalProps) {
  const { mounted, visible } = usePresence(open, 220);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  const containerCls =
    variant === "sheet"
      ? "fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      : "fixed inset-0 z-50 flex items-center justify-center p-6";

  return (
    <div className={containerCls}>
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/55 backdrop-blur-sm",
          visible
            ? "animate-in fade-in-0 duration-base"
            : "animate-out fade-out-0 duration-fast",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-card-lg border border-outline-variant bg-popover text-on-surface shadow-floating ring-1 ring-black/5",
          variant === "center" ? "max-w-lg" : "max-w-2xl rounded-b-none sm:rounded-card-lg",
          variant === "sheet" && !visible
            ? "translate-y-full"
            : variant === "sheet" && visible
              ? "translate-y-0"
              : "",
          variant === "center"
            ? visible
              ? "animate-in fade-in-0 zoom-in-95 duration-base ease-emphasized"
              : "animate-out fade-out-0 zoom-out-95 duration-fast"
            : visible
              ? "animate-in fade-in-0 slide-in-from-bottom-12 duration-moderate ease-emphasized"
              : "animate-out fade-out-0 slide-out-to-bottom-12 duration-fast",
          className,
        )}
      >
        {title ? (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-outline-variant/60 px-card_padding_lg py-4">
            <div className="min-w-0">
              <h2 className="text-headline-lg font-semibold tracking-tight text-on-surface">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-[13px] text-on-surface-variant">
                  {description}
                </p>
              ) : null}
            </div>
            {showClose ? (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-card_padding_lg py-card_padding_lg">
          {children}
        </div>
      </div>
    </div>
  );
}

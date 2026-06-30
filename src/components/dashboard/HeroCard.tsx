import { Cloud, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBucketStore } from "@/stores/useBucketStore";

const PROVIDER_LABEL: Record<string, string> = {
  aws_s3: "AWS S3",
  digitalocean_spaces: "DigitalOcean Spaces",
  cloudflare_r2: "Cloudflare R2",
  custom: "Custom S3",
};

export function HeroCard({ onAddBucket }: { onAddBucket?: () => void }) {
  const active = useBucketStore((s) => s.active);
  const subtitle = active
    ? `${PROVIDER_LABEL[active.provider] ?? active.provider}${active.region ? ` · ${active.region}` : ""}`
    : "No active bucket";

  return (
    <Card className="animate-card-enter stagger-1 flex flex-col justify-between gap-4 overflow-hidden p-card_padding_lg lg:flex-row lg:items-center">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-card bg-primary/15 text-primary ring-1 ring-inset ring-primary/20">
            <Cloud className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-display-sm font-semibold tracking-tight text-on-surface">
              Welcome to Bucketeer
            </h1>
            <p className="text-[13px] text-on-surface-variant">{subtitle}</p>
          </div>
        </div>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-on-surface-variant">
          Browse, edit, and transfer objects across every S3-compatible bucket.
          Pick a bucket below, or add a new one to get started.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button onClick={onAddBucket} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add bucket
        </Button>
      </div>
      <span className="pointer-events-none absolute -right-12 -top-12 hidden h-44 w-44 rounded-full bg-primary/5 blur-2xl lg:block" />
      <Sparkles className="pointer-events-none absolute right-6 top-6 hidden h-4 w-4 text-primary/30 lg:block" />
    </Card>
  );
}

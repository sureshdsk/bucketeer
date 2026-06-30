import { useExplorerStore } from "@/stores/useExplorerStore";
import { useBucketStore } from "@/stores/useBucketStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

/**
 * The single entry point for opening a bucket. Every path that navigates to a
 * bucket — sidebar click, saved location, bucket config, command palette —
 * funnels through here.
 *
 * Bucket switching is handled with a deliberate, SEQUENTIAL reset (never a
 * reactive effect), so nothing can race this call and clobber the bucket it
 * just set. The bucket list is intentionally NOT fetched — the sidebar shows
 * configured buckets, not the account-wide ListAllMyBuckets result.
 */
export async function openTarget(
  bucketId: string,
  bucket: string,
  prefix = "",
): Promise<void> {
  if (!bucketId || !bucket) return;
  const explorer = useExplorerStore.getState();
  const bucketStore = useBucketStore.getState();
  const saved = bucketStore.buckets.find((b) => b.id === bucketId) ?? null;
  if (bucketStore.active?.id !== bucketId) {
    bucketStore.select(bucketId);
    explorer.resetView();
  }
  explorer.setActiveBucket(bucketId);
  await explorer.parseAndOpenPath(`s3://${bucket}/${prefix}`);
  useWorkspaceStore.getState().updateActive({
    bucketId,
    bucketName: saved?.name ?? bucket,
    bucket,
    prefix,
  });
}

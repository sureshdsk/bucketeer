import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export interface UpdateStatus {
  available: boolean;
  version?: string;
  currentVersion: string;
  body?: string;
  error?: string;
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  try {
    const update = await check();
    if (update) {
      return {
        available: true,
        version: update.version,
        currentVersion: update.currentVersion,
        body: update.body,
      };
    }
    return { available: false, currentVersion: "" };
  } catch (err) {
    return {
      available: false,
      currentVersion: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function downloadAndInstall(
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const live = (await check()) as Update | null;
  if (!live) {
    throw new Error("No update is currently available.");
  }
  let total = 0;
  let downloaded = 0;
  await live.downloadAndInstall((event) => {
    if (event.event === "Started" && event.data.contentLength) {
      total = event.data.contentLength;
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      if (total > 0) onProgress?.(Math.min(1, downloaded / total));
    }
  });
  onProgress?.(1);
  await live.close();
  await relaunch();
}

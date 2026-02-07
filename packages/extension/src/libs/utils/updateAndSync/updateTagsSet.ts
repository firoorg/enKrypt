import { DB_DATA_KEYS, IndexedDBHelper } from '@action/db/indexedDB';
import { PublicFiroWallet } from '@/providers/bitcoin/libs/firo-wallet/public-firo-wallet';
import { differenceSets } from '@action/utils/set-utils';

type SetsUpdateResult = {
  tags: string[];
};

export type TagsSyncOptions = {
  intervalMs?: number;
  onUpdate?: (results: SetsUpdateResult) => void;
  onError?: (error: unknown) => void;
  onComplete?: () => void;
};

const wallet = new PublicFiroWallet();
const db = new IndexedDBHelper();

const syncTagsOnce = async (): Promise<SetsUpdateResult> => {
  try {
    const localTags = await db.readData<{ tags: string[]; txHashes: string[][] }>(
      DB_DATA_KEYS.usedCoinsTags,
    );

    const txHashes = await wallet.getUsedCoinsTagsTxHashes(0);
    const updates = await wallet.getUsedSparkCoinsTags(0);

    // const updatedTagsSet = new Set(updates?.tags || []);
    //
    // console.log('>>>>>> local coins tags', new Set(localTags.tags));
    // console.log('>>>>>> updates coins tags', new Set(updates.tags));

    // const mergedTags = Array.from(
    //   new Set([...(localTags?.tags ?? []), ...updatedTagsSet.values()]),
    // );

    // console.log('>>>>>> mergedTags coins tags', mergedTags);

    // Prevent sending updates if there are no new tags
    if (
      updates.tags.length === localTags?.tags?.length &&
      txHashes.tagsandtxids.length === localTags?.txHashes?.length
    ) {
      return { tags: [] };
    }

    // console.log('>>>>>> mergedTags coins tags', mergedTags);
    await db.saveData(DB_DATA_KEYS.usedCoinsTags, {
      tags: updates.tags,
      txHashes: txHashes.tagsandtxids,
    });

    return updates;
  } catch (error) {
    throw error;
  }
};

export const startTagSetSync = (options?: TagsSyncOptions) => {
  const intervalMs = options?.intervalMs ?? 60_000;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isRunning = false;
  let hasCompletedOnce = false;

  const fireCompleteOnce = () => {
    if (!hasCompletedOnce) {
      hasCompletedOnce = true;
      options?.onComplete?.();
    }
  };

  const scheduleNext = () => {
    if (stopped) return;
    timer = setTimeout(run, intervalMs);
  };

  const run = async () => {
    if (isRunning) {
      scheduleNext();
      return;
    }

    isRunning = true;
    try {
      const updates = await syncTagsOnce();

      if (updates?.tags?.length) {
        options?.onUpdate?.(updates);
      } else {
      }

      fireCompleteOnce();
    } catch (error) {
      options?.onError?.(error);

      fireCompleteOnce();
    } finally {
      isRunning = false;
      scheduleNext();
    }
  };

  run();

  return () => {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
};

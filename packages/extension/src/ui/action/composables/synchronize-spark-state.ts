import { ref, watch, Ref } from 'vue';
import { NetworkNames } from '@enkryptcom/types/dist';
import { startCoinSetSync } from '@/libs/utils/updateAndSync/updateCoinSet';
import { appendCoinSetUpdates } from '@/libs/utils/updateAndSync/handleCoinSetUpdates';
import { startTagSetSync } from '@/libs/utils/updateAndSync/updateTagsSet';
import { BaseNetwork } from '@/types/base-network';
import { FullTransactionModel} from '@/providers/bitcoin/libs/electrum-client/abstract-electrum';
import { markCoinsAsUsed } from '@/libs/utils/updateAndSync/markUsedCoins';

let worker: Worker | null = null;

export const useSynchronizeSparkState = (
  networkRef: Ref<BaseNetwork>,
  onBalanceCalculated?: (balance: string) => void,
) => {
  const isWorkerRunning = ref(false);
  const pendingWorkerRun = ref(false);
  const isPending = ref(false);
  const error = ref(null);

  const coinFetchDone = ref(false);
  const tagFetchDone = ref(false);

  const sparkUnusedTxDetails = ref<FullTransactionModel[]>([]);

  const cleanupAndMaybeRestart = () => {
    worker?.terminate();
    worker = null;

    isWorkerRunning.value = false;

    if (pendingWorkerRun.value) {
      console.log('[synchronizeWorker] restarting postponed run');
      synchronizeWorker();
    }
  };

  const synchronizeWorker = () => {
    if (isWorkerRunning.value) {
      pendingWorkerRun.value = true;
      console.log('Worker already running, skip start');
      return;
    }

    worker = new Worker(
      new URL('../workers/sparkCoinInfoWorker.ts', import.meta.url),
      { type: 'module' },
    );

    console.log('%c[synchronizeWorker] Worker initialized', 'color: green');

    isWorkerRunning.value = true;
    pendingWorkerRun.value = false;

    worker.onmessage = () => {
      coinFetchDone.value = true;
      cleanupAndMaybeRestart();
    };

    worker.onerror = () => {
      cleanupAndMaybeRestart();
    };

    worker.postMessage('');
  };

  const synchronize = async () => {
    try {
      const networkName = networkRef.value.name;
      if (networkName !== NetworkNames.Firo) return;

      isPending.value = true;

      const stopCoinSetSyncFn = startCoinSetSync({
        onComplete: async () => {
          synchronizeWorker();
        },
        onUpdate: async updates => {
          console.log(
            '%c[synchronize] Coin set updates received',
            'color: blue',
            updates,
          );
          await appendCoinSetUpdates(updates);
          synchronizeWorker();
        },
      });

      const stopSyncTagSetFn = startTagSetSync({
        onComplete: () => {
          tagFetchDone.value = true;
        },
        onUpdate: (updates) => {
          console.log('>>>>>> Tag set updated', updates);
        }
      });

      return { stopCoinSetSyncFn, stopSyncTagSetFn };
    } catch (err: any) {
      error.value = err;
      console.error('Syncing error:', err);
    } finally {
      isPending.value = false;
    }
  };

  watch(
    () => networkRef.value.name,
    async (_v, _ov, onCleanup) => {
      const stopFns = await synchronize();

      if (stopFns) {
        const { stopSyncTagSetFn, stopCoinSetSyncFn } = stopFns

        onCleanup(() => {
          console.log("%c[Network Change] Stopping previous sync processes", 'color: orange');
          stopCoinSetSyncFn();
          stopSyncTagSetFn();
        });
      }
    },
    { immediate: true }
  );

  watch(
    () => [coinFetchDone.value, tagFetchDone.value],
    async ([updatedCoinFetchDone, updatedTagFetchDone]) => {
      if (updatedCoinFetchDone && updatedTagFetchDone) {
        coinFetchDone.value = false;
        tagFetchDone.value = false;
        sparkUnusedTxDetails.value = await markCoinsAsUsed(onBalanceCalculated);
      }
    },
  );

  return {
    synchronize,
    isPending,
    error,
    sparkUnusedTxDetails,
  };
};

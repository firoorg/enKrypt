import { getSparkCoinInfo } from '@/libs/spark-handler/getSparkCoinInfo';
import { MyCoinModel } from '@/providers/bitcoin/libs/electrum-client/abstract-electrum';
import { DB_DATA_KEYS, IndexedDBHelper } from '@action/db/indexedDB';

interface IArgs {
  coin: string[];
  incomingViewKeyObj: number;
  fullViewKeyObj: number;
  wasmModule: WasmModule;
  keepMemory?: boolean;
  set: {
    id: number
    hash: string
  }
}

const db = new IndexedDBHelper();

let saveQueue: Promise<void> = Promise.resolve();

export const getSparkCoinAndSaveIntoDb = async ({ set, ...rest }: IArgs) => {
  try {
    const coinInfo = await getSparkCoinInfo(rest);

    const newCoin = {
      coin: coinInfo.originalCoin,
      setId: set.id,
      value: coinInfo.value,
      tag: coinInfo.tag,
      setHash: set.hash,
      isUsed: false,
    };
    console.log('>>>> newCoin', newCoin);

    saveQueue = saveQueue.then(async () => {
      const savedCoins = await db.readData<MyCoinModel[]>(DB_DATA_KEYS.myCoins) ?? [];

      const coinKey = `${newCoin.tag}:${newCoin.coin.join('|')}`;
      const isDuplicate = savedCoins.some(
        coin => `${coin.tag}:${coin.coin.join('|')}` === coinKey,
      );

      if (!isDuplicate) {
        await db.saveData(DB_DATA_KEYS.myCoins, [...savedCoins, newCoin]);
      }
    })

    return saveQueue;
  } catch {
    return;
  }
};

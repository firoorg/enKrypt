import { wasmInstance } from '@/libs/utils/wasm-loader.ts';
import {
  getIncomingViewKey,
  getSpendKeyObj,
} from '@/libs/spark-handler/generateSparkWallet.ts';
import { getSparkCoinInfo } from '@/libs/spark-handler/getSparkCoinInfo.ts';
import { IndexedDBHelper } from '@action/db/indexedDB.ts';
import { OwnedCoinData } from '@action/workers/sparkCoinInfoWorker.ts';
import * as bitcoin from 'bitcoinjs-lib';
import { PublicFiroWallet } from '@/providers/bitcoin/libs/firo-wallet/public-firo-wallet.ts';

import FiroAPI from '@/providers/bitcoin/libs/api-firo.ts';
import { isSparkAddress } from '@/providers/bitcoin/libs/utils.ts';
import {
  base64ToHex,
  getSerializedCoin,
} from '@/libs/spark-handler/getSerializedCoin.ts';

const SPARK_TX_TYPE = 9;

function numberToReversedHex(num: number) {
  let hex = num.toString(16);

  if (hex.length % 2 !== 0) {
    hex = '0' + hex;
  }

  const bytes = hex.match(/.{2}/g);
  const reversed = bytes?.reverse();

  return reversed?.join('');
}

function base64ToReversedHex(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const reversed = Array.from(bytes).reverse();
  return reversed.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sendFromSparkAddress(
  network: bitcoin.Network,
  to: string,
  amount: string,
  subtractFee = false,
) {
  const diversifier = 1n;
  const db = new IndexedDBHelper();
  const Module = await wasmInstance.getInstance();
  const spendKeyObj = await getSpendKeyObj(Module);
  const isSparkTransaction = await isSparkAddress(to);

  const ownedCoins = ((await db.readData('myCoins')) || []) as OwnedCoinData[];

  const uniqCoins = ownedCoins.filter(ownedCoin => {
    console.log(ownedCoin);
    return ownedCoin.setId === 7; // TODO: rm after fix duplicate coin fetch
  });

  const spendCoinList: {
    coin: string[];
    setId: number;
    metadata: number;
    deserializedCoinObj: number;
  }[] = [];

  const { incomingViewKeyObj, fullViewKeyObj } = await getIncomingViewKey(
    Module,
    spendKeyObj,
  );

  const addressObj = Module.ccall(
    'js_getAddress',
    'number',
    ['number', 'number'],
    [incomingViewKeyObj, diversifier],
  );

  // Create recipients vector for spend transaction
  const recipientsVector = Module.ccall(
    'js_createRecipientsVectorForCreateSparkSpendTransaction',
    'number',
    ['number'],
    [1], // intended final size
  );

  if (!isSparkTransaction) {
    Module.ccall(
      'js_addRecipientForCreateSparkSpendTransaction',
      null,
      ['number', 'number', 'number'],
      [recipientsVector, BigInt(+amount * 10 ** 8), 0],
    );
  }

  const privateRecipientsVector = Module.ccall(
    'js_createPrivateRecipientsVectorForCreateSparkSpendTransaction',
    'number',
    ['number'],
    [1], // intended final size
  );

  Module.ccall(
    'js_addPrivateRecipientForCreateSparkSpendTransaction',
    null,
    ['number', 'number', 'number', 'string', 'number'],
    [
      privateRecipientsVector,
      addressObj,
      BigInt(+amount * 10 ** 8),
      'Private memo',
      1,
    ],
  );

  const coinsList = Module.ccall(
    'js_createCoinsListForCreateSparkSpendTransaction',
    'number',
    [],
    [],
  );

  const coinMetaPromiseList: Promise<void>[] = [];

  uniqCoins.forEach(ownedCoin => {
    const myCoinMetaData = getSparkCoinInfo({
      coin: ownedCoin.coin,
      fullViewKeyObj,
      incomingViewKeyObj,
      wasmModule: Module,
      keepMemory: true,
    })
      .then(data => {
        console.log('%cdata', 'color: yellow; font-size: 24px;', data);
        if (!data.isUsed) {
          spendCoinList.push({
            coin: ownedCoin.coin,
            setId: ownedCoin.setId,
            metadata: data.metaData,
            deserializedCoinObj: data.deserializedCoinObj,
          });
        } else {
          console.log('Coin is used, skipping:', data);
        }
      })
      .catch(err => {
        console.error('Error getting spark coin info', err);
      });
    coinMetaPromiseList.push(myCoinMetaData);
  });

  await Promise.allSettled(coinMetaPromiseList);

  spendCoinList.forEach(spendCoin => {
    console.log(spendCoin.metadata, spendCoin.setId);
    Module.ccall(
      'js_setCSparkMintMetaId', // C++ function name
      null, // Return type
      ['number', 'number'], // Argument types
      [spendCoin.metadata, spendCoin.setId],
    );
  });

  try {
    spendCoinList.forEach(spendCoin => {
      Module.ccall(
        'js_addCoinToListForCreateSparkSpendTransaction',
        null,
        ['number', 'number'],
        [coinsList, spendCoin.metadata],
      );
    });
  } catch (error) {
    console.error('Error adding coins to list:', error);
  }
  const coverSetDataMap = Module.ccall(
    'js_createCoverSetDataMapForCreateSparkSpendTransaction',
    'number',
    [],
    [],
  );

  const groupedBySet = spendCoinList.reduce(
    (acc, coin) => {
      if (!acc[coin.setId]) {
        acc[coin.setId] = [];
      }
      acc[coin.setId].push(coin);
      return acc;
    },
    {} as Record<number, typeof spendCoinList>,
  );

  console.log('groupedBySet', groupedBySet);

  const deserializedCoinList: Record<string, number[]> = {};
  // TODO: move to separate function

  for (const set in groupedBySet) {
    const fullSet = await db.getSetById(Number(set));
    fullSet?.coins.forEach(coin => {
      const serializedCoin = getSerializedCoin(
        coin[0] as string,
      ) as unknown as ArrayLike<number>;

      const serializedCoinPointer = Module._malloc(serializedCoin.length);
      Module.HEAPU8.set(serializedCoin, serializedCoinPointer);

      const serialContext = getSerializedCoin(
        coin[2] as string,
      ) as unknown as ArrayLike<number>;

      const serialContextPointer = Module._malloc(serializedCoin.length);
      Module.HEAPU8.set(serialContext, serialContextPointer);

      const deserializedCoinObj = Module.ccall(
        'js_deserializeCoin',
        'number',
        ['number', 'number', 'number', 'number'],
        [
          serializedCoinPointer,
          serializedCoin.length,
          serialContextPointer,
          serialContext.length,
        ],
      );

      if (!deserializedCoinList[set]) {
        deserializedCoinList[set] = [];
      }
      deserializedCoinList[set].push(deserializedCoinObj);
    });
  }

  console.log('deserializedCoinList =:=:=:=', deserializedCoinList);

  const setHashList = await db.getSetHashes();

  for (const setId in groupedBySet) {
    const coverSetRepresentation = Buffer.from(
      setHashList[+setId - 1],
      'base64',
    );
    console.log('coverSetRepresentation :=>', coverSetRepresentation);
    const coverSetRepresentationPointer = Module._malloc(
      coverSetRepresentation.length,
    );
    Module.HEAPU8.set(coverSetRepresentation, coverSetRepresentationPointer);

    const coverSetData = Module.ccall(
      'js_createCoverSetData',
      'number',
      ['number', 'number'],
      [coverSetRepresentationPointer, coverSetRepresentation.length],
    );

    console.log(groupedBySet, setId);
    deserializedCoinList[setId].forEach(deserializedCoin => {
      Module.ccall(
        'js_addCoinToCoverSetData',
        null,
        ['number', 'number'],
        [coverSetData, deserializedCoin],
      );
      // console.count('Deserialized coin added');
    });

    // Add cover set data to map (with group ID 1)
    Module.ccall(
      'js_addCoverSetDataForCreateSparkSpendTransaction',
      null,
      ['number', 'number', 'number'],
      [coverSetDataMap, BigInt(setId), coverSetData],
    );
  }

  const idAndBlockHashesMap = Module.ccall(
    'js_createIdAndBlockHashesMapForCreateSparkSpendTransaction',
    'number',
    [],
    [],
  );

  const blockHashList = await db.getBlockHashes();
  console.log('blockHashList =>>>', blockHashList);
  for (const setId in groupedBySet) {
    console.log(BigInt(setId), base64ToHex(blockHashList[+setId - 1]));
    Module.ccall(
      'js_addIdAndBlockHashForCreateSparkSpendTransaction',
      null,
      ['number', 'number', 'string'],
      [
        idAndBlockHashesMap,
        BigInt(setId),
        base64ToReversedHex(blockHashList[+setId - 1]),
      ],
    );
  }

  // dummy values

  // const txHashSig = '0000000000';

  const lockTime = 999999;

  const tempTx = new bitcoin.Psbt({ network: network.networkInfo });
  tempTx.setVersion(3 | (SPARK_TX_TYPE << 16)); // version 3 and tx type in high bits (3 | (SPARK_TX_TYPE << 16));
  tempTx.setLocktime(lockTime); // new Date().getTime() / 1000

  tempTx.addInput({
    hash: '0000000000000000000000000000000000000000000000000000000000000000',
    index: 4294967295,
    sequence: 4294967295,
    finalScriptSig: Buffer.from('d3', 'hex'),
  });

  console.log(
    'tempTx.data.globalMap',
    tempTx.data.globalMap,
    'tempTx.data.inputs',
    tempTx.data.inputs,
    'tempTx',
    tempTx,
  );

  const tempTxBuffer = tempTx.extractTransaction(true).toBuffer();
  const extendedTempTxBuffer = Buffer.concat([
    tempTxBuffer,
    Buffer.from([0x00]),
  ]);

  console.log('buffer for temp', extendedTempTxBuffer.toHex());

  const txHash = bitcoin.crypto.hash256(extendedTempTxBuffer);
  const txHashSig = txHash.reverse().toString('hex');

  // TODO: check not spark case
  if (!isSparkTransaction) {
    tempTx.addOutput({
      address: to,
      value: parseFloat(amount),
    });
  }

  //tempTx// tx.signInput(0, spendKeyObj);  // ? how to sign? Is I need to sign wit all utxo keypairs? // ? how to add subtractFeeFromAmount? // ? what is spend transaction type? // https://github.com/firoorg/sparkmobile/blob/main/include/spark.h#L22
  // tx.finalizeAllInputs();
  // const txHash = tx.extractTransaction()

  // const txHashSig = txHash.getHash()

  console.log('coinlist', coinsList);
  const additionalTxSize = 0;

  // Create the spend transaction
  const result = Module.ccall(
    'js_createSparkSpendTransaction',
    'number',
    [
      'number',
      'number',
      'number',
      'number',
      'number',
      'number',
      'number',
      'number',
      'string',
      'number',
    ],
    [
      spendKeyObj,
      fullViewKeyObj,
      incomingViewKeyObj,
      recipientsVector,
      privateRecipientsVector,
      coinsList,
      coverSetDataMap,
      idAndBlockHashesMap,
      txHashSig,
      additionalTxSize,
    ],
  );

  console.log('final result is', result);

  if (result) {
    // Get transaction details

    const serializedSpend = Module.ccall(
      'js_getCreateSparkSpendTxResultSerializedSpend',
      'number', // returns a pointer to the beginning of a byte array
      ['number'],
      [result],
    );

    console.log('serializedSpend ==> ==>', serializedSpend);

    const serializedSpendSize = Module.ccall(
      'js_getCreateSparkSpendTxResultSerializedSpendSize',
      'number',
      ['number'],
      [result],
    );

    console.log(`Serialized spend size: `, serializedSpendSize);

    const serializedSpendBytes = new Uint8Array(
      Module.HEAPU8.buffer,
      serializedSpend,
      serializedSpendSize,
    );

    // Make a copy (optional, because the above is just a view into WASM memory)
    const spendDataCopy = new Uint8Array(serializedSpendBytes);

    // If you need hex
    const hex = Array.from(spendDataCopy)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('Serialized Spend (hex):', hex);

    const outputScriptsSize = Module.ccall(
      'js_getCreateSparkSpendTxResultOutputScriptsSize',
      'number',
      ['number'],
      [result],
    );
    const scripts = [];

    // Get each output script
    for (let i = 0; i < outputScriptsSize; i++) {
      const scriptPtr = Module.ccall(
        'js_getCreateSparkSpendTxResultOutputScriptAt',
        'number', // returns a pointer to the beginning of a byte array
        ['number', 'number'],
        [result, i],
      );

      console.log(`Output script in for:`, scriptPtr);
      const scriptSize = Module.ccall(
        'js_getCreateSparkSpendTxResultOutputScriptSizeAt',
        'number',
        ['number', 'number'],
        [result, i],
      );
      console.log(`Output script ${i} size: ${scriptSize}`);

      const script = new Uint8Array(
        Module.HEAPU8.buffer,
        scriptPtr,
        scriptSize,
      );

      scripts.push(script);
    }

    // Get spent coins information
    const spentCoinsSize = Module.ccall(
      'js_getCreateSparkSpendTxResultSpentCoinsSize',
      'number',
      ['number'],
      [result],
    );

    console.log(`Spent coins size: ${spentCoinsSize}`);

    for (let i = 0; i < spentCoinsSize; i++) {
      const spentCoinMeta = Module.ccall(
        'js_getCreateSparkSpendTxResultSpentCoinAt',
        'number',
        ['number', 'number'],
        [result, i],
      );
      const spentCoinValue = Module.ccall(
        'js_getCSparkMintMetaValue',
        'number',
        ['number'],
        [spentCoinMeta],
      );

      const spentCoinMetaDeserialized = new Uint8Array(
        Module.HEAPU8.buffer,
        spentCoinMeta,
        spentCoinMeta.length,
      );

      console.log(
        `spend coins meta @nd value ${spentCoinValue}, ${spentCoinMeta}  ${spentCoinMetaDeserialized.toString()}`,
      );
    }

    // Get transaction fee
    const fee = Module.ccall(
      'js_getCreateSparkSpendTxResultFee',
      'number',
      ['number'],
      [result],
    );

    const psbt = new bitcoin.Psbt({ network: network.networkInfo });

    const api = (await network.api()) as unknown as FiroAPI;

    psbt.addInput({
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
      index: 4294967295,
      sequence: 4294967295,
      finalScriptSig: Buffer.from('d3', 'hex'),
    });

    psbt.setLocktime(lockTime);

    psbt.setVersion(3 | (SPARK_TX_TYPE << 16));
    scripts.forEach(script => {
      console.log('script is ==>', script);
      psbt.addOutput({
        script: Buffer.from(script),
        value: 0,
      });
    });

    const rawTx = psbt.extractTransaction();
    const txHex = rawTx.toHex();
    const sizeHex = numberToReversedHex(serializedSpendSize);
    const finalTx = txHex + 'fd' + sizeHex + hex;

    api.broadcastTx(finalTx).then(console.log);

    // TODO: free memory
  }
}

import { validator } from '@/providers/bitcoin/libs/firo-wallet/base-firo-wallet';
import BigNumber from 'bignumber.js';
import * as bitcoin from 'bitcoinjs-lib';
import { HaskoinUnspentType } from '@/providers/bitcoin/types';

interface CreateTempTxArgs {
  network: bitcoin.networks.Network;
  changeAmount: BigNumber;
  mintValueOutput: {
    script: Buffer<ArrayBuffer>;
    value: number;
  }[];
  inputs: {
    hash: string;
    index: number;
    nonWitnessUtxo: Buffer<ArrayBuffer>;
  }[];
  utxos: HaskoinUnspentType[];
  keyPair: Record<string, any>;
}

export const createTempTx = ({
  network,
  inputs,
  utxos,
  keyPair,
  mintValueOutput,
  changeAmount,
}: CreateTempTxArgs) => {
  const tx = new bitcoin.Psbt({ network });
  tx.setVersion(2);

  inputs.forEach(input => {
    tx.addInput(input);
  });

  mintValueOutput.forEach(mint => {
    tx.addOutput({
      script: mint.script,
      value: mint.value,
    });
  });

  if (changeAmount.gt(0)) {
    const firstUtxoAddress = utxos[0].address;

    tx.addOutput({
      address: firstUtxoAddress!,
      value: changeAmount.toNumber(),
    });
  }

  for (let index = 0; index < utxos.length; index++) {
    const Signer = {
      sign: (hash: Uint8Array) => {
        return Buffer.from(keyPair.sign(hash));
      },
      publicKey: Buffer.from(keyPair.publicKey),
    } as unknown as bitcoin.Signer;

    tx.signInput(index, Signer);
  }
  tx.validateSignaturesOfAllInputs(validator);
  tx.finalizeAllInputs();

  return tx.extractTransaction();
};
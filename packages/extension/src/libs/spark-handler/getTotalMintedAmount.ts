import BigNumber from 'bignumber.js';
import { HaskoinUnspentType } from '@/providers/bitcoin/types';


export const getTotalMintedAmount = async (spendableUtxos: HaskoinUnspentType[]) => {
  let inputAmount = 0;
  const psbtInputs = [];

  for (const utxo of spendableUtxos) {
    psbtInputs.push({
      hash: utxo.txid,
      index: utxo.index,
      nonWitnessUtxo: Buffer.from(utxo.raw!, 'hex'),
    });

    inputAmount += utxo.value;
  }

  return { inputAmountBn: new BigNumber(inputAmount), psbtInputs };
};
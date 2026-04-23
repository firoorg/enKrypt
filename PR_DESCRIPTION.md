# Add Firo network support (transparent + Spark private addresses)

## Summary

This PR adds full support for the **Firo** network to Enkrypt, including both the
standard transparent UTXO wallet and the **Spark** privacy protocol (private
addresses, mints and spends). It also adds a Firo-specific Electrum client,
activity handler, synchronization flow for the Spark anonymity set, and all of
the UI needed to deposit, send and view balances on both address types.

No changes are made to existing networks; everything is additive under the
Bitcoin-family provider and a new `spark-handler` library.

## What's included

### Network / chain integration
- New networks: `firo` (mainnet) and `firo-testnet`, added under the Bitcoin
  provider with icon, config and test coverage.
- Firo-specific Electrum client (`electrum-client.ts`, `abstract-electrum.ts`)
  used for transparent UTXOs, anonymity-set sync, and broadcasting.
- Firo REST API wrapper (`api-firo.ts`) and activity handler
  (`activity-handlers/providers/firo`).

### Transparent wallet
- `firo-wallet/base-firo-wallet.ts` + configs/utils implement Firo-flavoured
  transparent address derivation, UTXO selection and signing.
- Transparent send flow (`tabs/transparent-send-tab.vue`) and updated
  `verify-transaction` screen.

### Spark (private) support
- `spark-handler/` library wrapping the Spark WASM module:
  `generateSparkWallet`, `getMintTxData`, `getSparkCoinInfo`, `getFee`,
  `getSerializedCoin`, `getTotalMintedAmount`, `createTempTx`,
  `createTempFromSparkTx`, `serializeMintContext`.
- Bundled Spark WASM (`libs/utils/wasmModule/spark.{js,wasm}`) and a worker copy
  (`wasmWorkerModule/`) with `wasm-loader.ts` / `wasm-worker-loader.ts`.
- Background worker `sparkCoinInfoWorker.ts` to decode coin info off the main
  thread.
- Anonymity-set / tags sync pipeline under `libs/utils/updateAndSync/`:
  `updateCoinSet`, `updateTagsSet`, `handleCoinSetUpdates`, `markCoinsAsUsed`,
  `calculateCurrentSparkBalance`, `getSetsFromDb`.
- IndexedDB store (`ui/action/db/indexedDB.ts`) persisting coins, tags and the
  last scanned coin-set id so re-opening the wallet resumes incrementally
  instead of re-scanning.
- Composables: `synchronize-spark-state`, `get-spark-address`,
  `update-activity-state`, `async-computed`.

### UI
- Spark send tab (`tabs/spark-send-tab.vue`) and Spark address input
  (`send-spark-address-input.vue`) with support for both Spark→Spark and
  Spark→transparent sends.
- Verify screens for Spark send flows
  (`verify-send-from-spark-transaction`, `verify-send-to-spark-transaction`).
- `synchronize-state.vue` progress UI shown while the anonymity set syncs.
- Deposit view updated to expose both the transparent and Spark addresses; QR
  encodes `Firo:{address}`.
- Accounts list / modal show the Spark address alongside the transparent
  address; non-compatible accounts are filtered out on Firo.
- Reset-wallet flow clears the Spark IndexedDB.

### Keyring / infrastructure
- `packages/keyring` bumped and extended with Firo signer hooks.
- `public-keyring` / `keyring.ts` updated to expose Firo key material.
- Vite config and `tsconfig.app.json` updated to bundle the WASM assets; new
  `.prettierignore` entry to skip the generated `spark.js`.

## Notes for reviewers

A few things are worth flagging explicitly so they are not mistaken for bugs:

- **Token list balance is transparent-only.** The account row / token list in
  the main wallet view displays only the **transparent FIRO balance**. It does
  **not** aggregate transparent + private (Spark) balance. The private balance
  is visible inside the Firo-specific views (send flow, deposit view, activity
  screen) once the anonymity set has synced.
- **Spark spends show as "swapped".** Both incoming and outgoing Spark spends
  are rendered with the "swapped" activity icon/label. This is a limitation of
  Enkrypt's activity UI (there is no native "shielded transfer" category to
  map to); we were advised to accept this rather than patch the shared
  activity types.
- **Initial sync is long.** On first unlock with a Firo account, the extension
  downloads the full Spark coin set and tag set, decodes coins in a worker,
  and writes them to IndexedDB. The `synchronize-state.vue` modal reflects
  progress. Subsequent unlocks resume from the last stored coin-set id.
- **WASM memory.** Several commits late in the branch tighten WASM pointer
  lifetimes (`getMintTxData`, `getSparkCoinInfo`, and the `serialContext`
  buffer allocation). If you see review questions about manual `_free` calls,
  that is why.
- **Scope.** Only Firo code paths are touched; other Bitcoin-family networks
  (BTC, LTC, DOGE, …) continue to use the existing send-transaction view and
  are unaffected.

## Test plan

- [ ] Import a seed, confirm both transparent and Spark addresses are derived
      and shown in the accounts list and deposit view.
- [ ] Receive transparent FIRO; confirm balance + activity entry.
- [ ] Receive private FIRO (mint); confirm Spark balance appears after sync.
- [ ] Send transparent → transparent.
- [ ] Send transparent → Spark (mint).
- [ ] Send Spark → Spark.
- [ ] Send Spark → transparent (spend).
- [ ] Lock / unlock and confirm sync resumes from IndexedDB.
- [ ] Reset wallet and confirm Spark DB is cleared.
- [ ] Confirm other networks (BTC, ETH, …) are unaffected.

import * as ledger from "@midnight-ntwrk/midnight-js-protocol/v9"
import {
  DustWallet,
  NoOpTransactionHistoryStorage,
  PublicKey,
  ShieldedWallet,
  UnshieldedWallet,
  WalletFacade
} from "@midnightntwrk/wallet-sdk"

import type { MidnightEndpoints } from "../../types/midnight_endpoints.type.ts"
import type { SavedWalletState } from "../../types/saved_wallet_state.type.ts"
import type { WalletKeys } from "../../types/wallet_keys.type.ts"
import { withProjectId } from "./blockfrost_url.ts"

async function startWalletFacade(
  endpoints: MidnightEndpoints,
  projectId: string,
  keys: WalletKeys,
  saved: SavedWalletState | undefined
): Promise<WalletFacade> {
  const { seeds, unshieldedKeystore } = keys

  const wallet = await WalletFacade.init({
    configuration: {
      networkId: endpoints.networkId,
      indexerClientConnection: {
        indexerHttpUrl: withProjectId(endpoints.indexerHttpUrl, projectId),
        indexerWsUrl: withProjectId(endpoints.indexerWsUrl, projectId)
      },
      provingServerUrl: new URL(endpoints.proofServerUrl),
      relayURL: new URL(withProjectId(endpoints.nodeWsUrl, projectId)),
      txHistoryStorage: new NoOpTransactionHistoryStorage(),
      skipLedgerV8DustHistory: true,
      costParameters: {
        additionalFeeOverhead: 1_000n,
        feeBlocksMargin: 5
      }
    },
    shielded: (configuration) =>
      saved
        ? ShieldedWallet(configuration).restore(saved.shielded)
        : ShieldedWallet(configuration).startWithSeed(seeds.shielded),
    unshielded: (configuration) =>
      saved
        ? UnshieldedWallet(configuration).restore(saved.unshielded)
        : UnshieldedWallet(configuration).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (configuration) =>
      saved
        ? DustWallet(configuration).restore(saved.dust)
        : DustWallet(configuration).startWithSeed(seeds.dust, ledger.LedgerParameters.initialParameters().dust)
  })

  await wallet.start(seeds)

  return wallet
}

export { startWalletFacade }

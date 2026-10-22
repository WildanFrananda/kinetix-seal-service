import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id"
import * as ledger from "@midnight-ntwrk/midnight-js-protocol/ledger"
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
  const { shieldedSecretKeys, dustSecretKey, unshieldedKeystore } = keys

  const wallet = await WalletFacade.init({
    configuration: {
      networkId: getNetworkId(),
      indexerClientConnection: {
        indexerHttpUrl: withProjectId(endpoints.indexerHttpUrl, projectId),
        indexerWsUrl: withProjectId(endpoints.indexerWsUrl, projectId)
      },
      provingServerUrl: new URL(endpoints.proofServerUrl),
      relayURL: new URL(withProjectId(endpoints.nodeWsUrl, projectId)),
      txHistoryStorage: new NoOpTransactionHistoryStorage(),
      costParameters: {
        additionalFeeOverhead: 1_000n,
        feeBlocksMargin: 5
      }
    },
    shielded: (configuration) =>
      saved
        ? ShieldedWallet(configuration).restore(saved.shielded)
        : ShieldedWallet(configuration).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (configuration) =>
      saved
        ? UnshieldedWallet(configuration).restore(saved.unshielded)
        : UnshieldedWallet(configuration).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (configuration) =>
      saved
        ? DustWallet(configuration).restore(saved.dust)
        : DustWallet(configuration).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust)
  })

  await wallet.start(shieldedSecretKeys, dustSecretKey)

  return wallet
}

export { startWalletFacade }

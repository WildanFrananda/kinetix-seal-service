import type { ProofProvider, PublicDataProvider, ZKConfigProvider } from "@midnight-ntwrk/midnight-js-types"
import type { WalletFacade } from "@midnightntwrk/wallet-sdk"

import type IndexerBlocks from "../infrastructure/midnight/indexer_blocks.ts"
import type { WalletKeys } from "./wallet_keys.type.ts"

type MidnightRegistryChainDependencies = {
  wallet: WalletFacade
  keys: WalletKeys
  publicData: PublicDataProvider
  proofs: ProofProvider
  zkConfig: ZKConfigProvider<string>
  blocks: IndexerBlocks
  issuerSecret: Uint8Array
  networkStepSeconds: number
}

export type { MidnightRegistryChainDependencies }

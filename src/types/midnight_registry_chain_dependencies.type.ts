import type {
  MidnightConfig,
  ProofProvider,
  PublicDataProvider,
  ZKConfigProvider
} from "@midnight-ntwrk/midnight-js-types"

import type { TransactionPayerPort } from "../application/ports/transaction_payer.port.ts"
import type IndexerBlocks from "../infrastructure/midnight/indexer_blocks.ts"

type MidnightRegistryChainDependencies = {
  payer: TransactionPayerPort
  publicData: PublicDataProvider
  proofs: ProofProvider
  zkConfig: ZKConfigProvider<string>
  blocks: IndexerBlocks
  issuerSecret: Uint8Array
  config: MidnightConfig
  networkStepSeconds: number
}

export type { MidnightRegistryChainDependencies }

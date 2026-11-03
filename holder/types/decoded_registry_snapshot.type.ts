import type { ContractState } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime"
import type { LedgerParameters, ZswapChainState } from "@midnight-ntwrk/midnight-js-protocol/ledger"

type DecodedRegistrySnapshot = {
  generation: number
  networkId: string
  contractAddress: string
  contractState: ContractState
  zswapChainState: ZswapChainState
  ledgerParameters: LedgerParameters
}

export type { DecodedRegistrySnapshot }

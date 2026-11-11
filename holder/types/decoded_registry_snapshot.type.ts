import type {
  SerializedContractState,
  SerializedLedgerParameters,
  SerializedZswapChainState
} from "@midnight-ntwrk/midnight-js-types"

type DecodedRegistrySnapshot = {
  generation: number
  networkId: string
  contractAddress: string
  contractState: SerializedContractState<"v9">
  zswapChainState: SerializedZswapChainState<"v9">
  ledgerParameters: SerializedLedgerParameters<"v9">
}

export type { DecodedRegistrySnapshot }

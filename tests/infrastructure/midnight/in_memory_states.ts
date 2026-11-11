import { ContractState } from "@midnight-ntwrk/compact-runtime"
import { LedgerParameters, ZswapChainState } from "@midnight-ntwrk/midnight-js-protocol/v9"
import {
  type MidnightConfig,
  SerializedContractState,
  SerializedLedgerParameters,
  SerializedZswapChainState
} from "@midnight-ntwrk/midnight-js-types"

const inMemoryConfig: MidnightConfig = { networkId: "undeployed", ttlSeconds: 3600 }

function decodedContractState(serialized: SerializedContractState): ContractState {
  return serialized.deserialize({ v9: ContractState })
}

function inMemoryCallStates(state: ContractState) {
  return {
    initialContractState: SerializedContractState.fromBytes("v9", state.serialize()),
    initialZswapChainState: SerializedZswapChainState.fromBytes("v9", new ZswapChainState().serialize()),
    ledgerParameters: SerializedLedgerParameters.fromBytes("v9", LedgerParameters.initialParameters().serialize())
  }
}

export { decodedContractState, inMemoryCallStates, inMemoryConfig }

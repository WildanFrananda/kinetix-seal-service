import {
  SerializedContractState,
  SerializedLedgerParameters,
  SerializedZswapChainState
} from "@midnight-ntwrk/midnight-js-types"

import type { RegistrySnapshotWire } from "../../src/types/registry_snapshot_wire.type.ts"
import type { DecodedRegistrySnapshot } from "../types/decoded_registry_snapshot.type.ts"
import { bytesOf } from "./hex.ts"

function decodeRegistrySnapshot(wire: RegistrySnapshotWire): DecodedRegistrySnapshot {
  return {
    generation: wire.generation,
    networkId: wire.networkId,
    contractAddress: wire.contractAddress,
    contractState: SerializedContractState.fromBytes("v9", bytesOf(wire.contractState)),
    zswapChainState: SerializedZswapChainState.fromBytes("v9", bytesOf(wire.zswapChainState)),
    ledgerParameters: SerializedLedgerParameters.fromBytes("v9", bytesOf(wire.ledgerParameters))
  }
}

export { decodeRegistrySnapshot }

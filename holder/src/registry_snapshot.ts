import { ContractState } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime"
import { LedgerParameters, ZswapChainState } from "@midnight-ntwrk/midnight-js-protocol/ledger"

import type { RegistrySnapshotWire } from "../../src/types/registry_snapshot_wire.type.ts"
import type { DecodedRegistrySnapshot } from "../types/decoded_registry_snapshot.type.ts"
import { bytesOf } from "./hex.ts"

function decodeRegistrySnapshot(wire: RegistrySnapshotWire): DecodedRegistrySnapshot {
  return {
    generation: wire.generation,
    networkId: wire.networkId,
    contractAddress: wire.contractAddress,
    contractState: ContractState.deserialize(bytesOf(wire.contractState)),
    zswapChainState: ZswapChainState.deserialize(bytesOf(wire.zswapChainState)),
    ledgerParameters: LedgerParameters.deserialize(bytesOf(wire.ledgerParameters))
  }
}

export { decodeRegistrySnapshot }

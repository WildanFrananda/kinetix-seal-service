import type { MerkleTreePath, WitnessContext } from "@midnight-ntwrk/compact-runtime"

import type { Ledger, Witnesses } from "#contracts/report_registry/contract/index.js"
import type { ReportRegistryPrivateState } from "../../types/report_registry_private_state.type.ts"

type Context = WitnessContext<Ledger, ReportRegistryPrivateState>

function issuerSecret({ privateState }: Context): [ReportRegistryPrivateState, Uint8Array] {
  if (privateState.role !== "issuer") {
    throw new Error("only the issuer knows the issuer secret")
  }

  return [privateState, privateState.issuerSecret]
}

function reporterSecret({ privateState }: Context): [ReportRegistryPrivateState, Uint8Array] {
  if (privateState.role !== "reporter") {
    throw new Error("only a reporter knows a reporter secret")
  }

  return [privateState, privateState.reporterSecret]
}

function heldOrder({ privateState }: Context): [ReportRegistryPrivateState, Uint8Array] {
  if (privateState.role !== "reporter") {
    throw new Error("only a reporter holds an order")
  }

  return [privateState, privateState.order]
}

function rightPath(
  { privateState, ledger }: Context,
  leaf: Uint8Array
): [ReportRegistryPrivateState, MerkleTreePath<Uint8Array>] {
  if (privateState.role !== "reporter") {
    throw new Error("only a reporter has a right path")
  }

  if (privateState.leafIndex >= ledger.rights.firstFree()) {
    throw new Error("the right is not in the registry")
  }

  return [privateState, ledger.rights.pathForLeaf(privateState.leafIndex, leaf)]
}

const reportRegistryWitnesses: Witnesses<ReportRegistryPrivateState> = {
  issuerSecret,
  reporterSecret,
  heldOrder,
  rightPath
}

export { reportRegistryWitnesses }

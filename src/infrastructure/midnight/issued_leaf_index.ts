import {
  CompactTypeField,
  CompactTypeVector,
  degradeToTransient,
  type MerkleTreePath,
  transientHash
} from "@midnight-ntwrk/compact-runtime"

import type { Ledger } from "#contracts/credential_registry/contract/index.js"

const fieldPair = new CompactTypeVector(2, CompactTypeField)

function rootWithoutLeafHash(path: MerkleTreePath<Uint8Array>): bigint {
  let digest = degradeToTransient(path.leaf)

  for (const entry of path.path) {
    digest = entry.goes_left
      ? transientHash(fieldPair, [digest, entry.sibling.field])
      : transientHash(fieldPair, [entry.sibling.field, digest])
  }

  return digest
}

function issuedLeafIndex(
  issued: Pick<Ledger["issued"], "root" | "firstFree" | "pathForLeaf">,
  leaf: Uint8Array
): bigint | undefined {
  const root = issued.root().field

  for (let index = issued.firstFree() - 1n; index >= 0n; index -= 1n) {
    if (rootWithoutLeafHash(issued.pathForLeaf(index, leaf)) === root) {
      return index
    }
  }

  return undefined
}

export { issuedLeafIndex }

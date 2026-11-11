import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { describe, it } from "node:test"

import { type Predicate, pureCircuits } from "#contracts/credential_registry/contract/index.js"
import { courierClassId } from "../../../src/domain/credential_classes.ts"
import { credentialLeafOf } from "../../../src/infrastructure/midnight/credential_leaf.ts"
import { issuedLeafIndex } from "../../../src/infrastructure/midnight/issued_leaf_index.ts"
import type { HolderPrivateState } from "../../../src/types/holder_private_state.type.ts"
import type { IssuerPrivateState } from "../../../src/types/issuer_private_state.type.ts"
import { credentialRecord } from "../../fakes/credential_record.ts"
import InMemoryCredentialRegistry from "./in_memory_credential_registry.ts"

const predicate: Predicate = { classId: courierClassId, minimums: [10n, 400n, 7n, 20_700n] }

function newIssuer(): IssuerPrivateState {
  return { role: "issuer", issuerSecret: randomBytes(32) }
}

describe("the leaf seal issues", () => {
  it("is the leaf a holder proves against: a holder presents what seal issued", async () => {
    const issuer = newIssuer()
    const registry = await InMemoryCredentialRegistry.deploy(issuer.issuerSecret)
    const holderSecret = randomBytes(32)
    const record = credentialRecord({
      holderPublicKey: pureCircuits.holderPublicKey(holderSecret),
      salt: randomBytes(32)
    })

    const leaf = credentialLeafOf(record)

    await registry.approvePredicate(predicate, issuer)
    await registry.issue(leaf, issuer)

    const holder: HolderPrivateState = {
      role: "holder",
      holderSecret,
      credential: { classId: record.classId, attributes: record.attributes, salt: record.salt },
      leafIndex: 0n
    }

    const challenge = randomBytes(32)

    await registry.present(challenge, pureCircuits.predicateId(predicate), holder)

    assert.equal(registry.ledger().presentations.member(challenge), true)
  })

  it("changes with every attribute, the salt and the holder key", () => {
    const base = credentialRecord({})
    const variants = [
      credentialRecord({ attributes: [13n, 450n, 30n, 20_759n] }),
      credentialRecord({ salt: new Uint8Array(32).fill(8) }),
      credentialRecord({ holderPublicKey: base.holderPublicKey + 1n })
    ]

    const leaves = new Set([base, ...variants].map((record) => Buffer.from(credentialLeafOf(record)).toString("hex")))

    assert.equal(leaves.size, 4)
  })
})

describe("finding where a leaf landed", () => {
  it("names each issued leaf's index, and none for a leaf never issued", async () => {
    const issuer = newIssuer()
    const registry = await InMemoryCredentialRegistry.deploy(issuer.issuerSecret)
    const leaves = Array.from({ length: 6 }, () => credentialLeafOf(credentialRecord({ salt: randomBytes(32) })))

    assert.equal(issuedLeafIndex(registry.ledger().issued, leaves[0] ?? new Uint8Array(32)), undefined)

    for (const leaf of leaves) {
      await registry.issue(leaf, issuer)
    }

    for (const [index, leaf] of leaves.entries()) {
      assert.equal(issuedLeafIndex(registry.ledger().issued, leaf), BigInt(index))
    }

    assert.equal(issuedLeafIndex(registry.ledger().issued, new Uint8Array(32).fill(1)), undefined)
  })

  it("no longer finds a revoked leaf, and still finds the others", async () => {
    const issuer = newIssuer()
    const registry = await InMemoryCredentialRegistry.deploy(issuer.issuerSecret)
    const leaves = Array.from({ length: 3 }, () => credentialLeafOf(credentialRecord({ salt: randomBytes(32) })))

    for (const leaf of leaves) {
      await registry.issue(leaf, issuer)
    }

    await registry.revoke(1n, issuer)

    const issued = registry.ledger().issued

    assert.deepEqual(
      leaves.map((leaf) => issuedLeafIndex(issued, leaf)),
      [0n, undefined, 2n]
    )
  })
})

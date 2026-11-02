import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { describe, it } from "node:test"
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id"

import { pureCircuits } from "#contracts/credential_registry/contract/index.js"
import { hexOf } from "../../../src/domain/hex.ts"
import { predicateRowsOf } from "../../../src/domain/predicate_rows.ts"
import { credentialLeafOf } from "../../../src/infrastructure/midnight/credential_leaf.ts"
import { placedPredicatesOf } from "../../../src/infrastructure/midnight/placed_predicates.ts"
import type { HolderPrivateState } from "../../../src/types/holder_private_state.type.ts"
import type { IssuerPrivateState } from "../../../src/types/issuer_private_state.type.ts"
import { credentialRecord } from "../../fakes/credential_record.ts"
import { predicateTemplate } from "../../fakes/predicate_template.ts"
import InMemoryCredentialRegistry from "./in_memory_credential_registry.ts"

setNetworkId("undeployed")

const issuer: IssuerPrivateState = { role: "issuer", issuerSecret: randomBytes(32) }
const [currentRow, previousRow] = predicateRowsOf(
  predicateTemplate({ minimums: [10n, 400n, 7n], freshnessDays: 30 }),
  20_759,
  7
)

function holderOf(issueDay: number) {
  const holderSecret = randomBytes(32)
  const record = credentialRecord({
    attributes: [12n, 450n, 30n, BigInt(issueDay)],
    issueDay,
    holderPublicKey: pureCircuits.holderPublicKey(holderSecret),
    salt: randomBytes(32)
  })

  const holder: HolderPrivateState = {
    role: "holder",
    holderSecret,
    credential: { classId: record.classId, attributes: record.attributes, salt: record.salt },
    leafIndex: 0n
  }

  return { leaf: credentialLeafOf(record), holder }
}

describe("the predicates a registry holds", () => {
  it("are read back with the ids the contract gives them, and leave when withdrawn", async () => {
    assert.ok(currentRow !== undefined && previousRow !== undefined)

    const registry = await InMemoryCredentialRegistry.deploy(issuer.issuerSecret)

    assert.deepEqual(placedPredicatesOf(registry.ledger().predicates), [])

    await registry.approvePredicate(currentRow.predicate, issuer)
    await registry.approvePredicate(previousRow.predicate, issuer)

    const placed = placedPredicatesOf(registry.ledger().predicates)

    assert.deepEqual(
      placed.map((placement) => hexOf(placement.id)).sort(),
      [currentRow, previousRow].map((row) => hexOf(pureCircuits.predicateId(row.predicate))).sort()
    )

    assert.deepEqual(placed.map((placement) => placement.predicate.minimums.join(",")).sort(), [
      "10,400,7,20718",
      "10,400,7,20725"
    ])

    await registry.withdrawPredicate(pureCircuits.predicateId(previousRow.predicate), issuer)

    assert.deepEqual(
      placedPredicatesOf(registry.ledger().predicates).map((placement) => hexOf(placement.id)),
      [hexOf(pureCircuits.predicateId(currentRow.predicate))]
    )
  })

  it("let the chain itself refuse a credential older than the row's minimum issue day", async () => {
    assert.ok(currentRow !== undefined)

    const id = pureCircuits.predicateId(currentRow.predicate)
    const fresh = await InMemoryCredentialRegistry.deploy(issuer.issuerSecret)
    const recent = holderOf(20_725)

    await fresh.approvePredicate(currentRow.predicate, issuer)
    await fresh.issue(recent.leaf, issuer)
    await fresh.present(randomBytes(32), id, recent.holder)

    const stale = await InMemoryCredentialRegistry.deploy(issuer.issuerSecret)
    const old = holderOf(20_724)

    await stale.approvePredicate(currentRow.predicate, issuer)
    await stale.issue(old.leaf, issuer)
    await assert.rejects(stale.present(randomBytes(32), id, old.holder), /does not meet the predicate/)
  })
})

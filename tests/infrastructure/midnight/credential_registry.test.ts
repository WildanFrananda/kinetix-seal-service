import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, it } from "node:test"
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id"
import { Zkir } from "@midnight-ntwrk/zkir-v2"

import { type Credential, type Predicate, pureCircuits } from "#contracts/credential_registry/contract/index.js"
import { credentialRegistryDirectory } from "../../../src/infrastructure/midnight/credential_registry_contract.ts"
import type { HolderPrivateState } from "../../../src/types/holder_private_state.type.ts"
import type { IssuerPrivateState } from "../../../src/types/issuer_private_state.type.ts"
import InMemoryCredentialRegistry from "./in_memory_credential_registry.ts"

setNetworkId("undeployed")

const issueDay = 20_390n

function label(text: string): Uint8Array {
  const bytes = new Uint8Array(32)

  bytes.set(new TextEncoder().encode(text))

  return bytes
}

const courierClass = label("kinetix:seal:courier:v1")
const merchantClass = label("kinetix:seal:merchant:v1")

const courierPredicate: Predicate = {
  classId: courierClass,
  minimums: [500n, 450n, 180n, issueDay - 30n]
}

function causedBy(pattern: RegExp): (error: unknown) => boolean {
  return function matches(error: unknown): boolean {
    let current: unknown = error

    while (current instanceof Error) {
      if (pattern.test(current.message)) {
        return true
      }

      current = current.cause
    }

    return false
  }
}

function newIssuer(): IssuerPrivateState {
  return { role: "issuer", issuerSecret: randomBytes(32) }
}

function courierCredential(attributes: bigint[]): Credential {
  return { classId: courierClass, attributes, salt: randomBytes(32) }
}

async function issueTo(
  registry: InMemoryCredentialRegistry,
  issuer: IssuerPrivateState,
  credential: Credential
): Promise<HolderPrivateState> {
  const holderSecret = randomBytes(32)
  const leafIndex = registry.ledger().issued.firstFree()

  await registry.issue(pureCircuits.credentialLeaf(credential, pureCircuits.holderPublicKey(holderSecret)), issuer)

  return { role: "holder", holderSecret, credential, leafIndex }
}

async function registryWithPredicate(): Promise<{ registry: InMemoryCredentialRegistry; issuer: IssuerPrivateState }> {
  const issuer = newIssuer()
  const registry = await InMemoryCredentialRegistry.deploy(issuer.issuerSecret)

  await registry.approvePredicate(courierPredicate, issuer)

  return { registry, issuer }
}

describe("the credential registry contract", () => {
  it("keeps present small enough for a phone to prove in about a minute (SEAL-D11)", async () => {
    const zkir = Zkir.deserialize(await readFile(join(credentialRegistryDirectory, "zkir", "present.bzkir")))

    assert.ok(zkir.getK() <= 12, `present is k=${zkir.getK()}`)
  })

  it("names a predicate by its content, so an id never changes meaning", () => {
    const stricter: Predicate = { ...courierPredicate, minimums: [600n, 450n, 180n, issueDay - 30n] }

    assert.deepEqual(pureCircuits.predicateId(courierPredicate), pureCircuits.predicateId({ ...courierPredicate }))
    assert.notDeepEqual(pureCircuits.predicateId(courierPredicate), pureCircuits.predicateId(stricter))
  })

  it("lets only the issuer issue", async () => {
    const issuer = newIssuer()
    const registry = await InMemoryCredentialRegistry.deploy(issuer.issuerSecret)

    await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))

    await assert.rejects(issueTo(registry, newIssuer(), courierCredential([1n, 1n, 1n, issueDay])), /not the issuer/)
    assert.equal(registry.ledger().issued.firstFree(), 1n)
  })

  it("lets only the issuer approve or withdraw a predicate", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const id = pureCircuits.predicateId(courierPredicate)

    await assert.rejects(registry.withdrawPredicate(id, newIssuer()), /not the issuer/)
    await assert.rejects(
      registry.approvePredicate({ ...courierPredicate, minimums: [1n, 0n, 0n, 0n] }, newIssuer()),
      /not the issuer/
    )
    await assert.rejects(registry.approvePredicate(courierPredicate, issuer), /already approved/)
    assert.equal(registry.ledger().predicates.size(), 1n)
  })

  it("accepts a holder who meets an approved predicate, and records the challenge against it", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const holder = await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))
    const challenge = randomBytes(32)
    const id = pureCircuits.predicateId(courierPredicate)

    await registry.present(challenge, id, holder)

    assert.deepEqual(registry.ledger().presentations.lookup(challenge), id)
  })

  it("accepts a holder exactly at every minimum", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const holder = await issueTo(registry, issuer, courierCredential([...courierPredicate.minimums]))

    await registry.present(randomBytes(32), pureCircuits.predicateId(courierPredicate), holder)

    assert.equal(registry.ledger().presentations.size(), 1n)
  })

  it("refuses a holder below any one minimum", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const id = pureCircuits.predicateId(courierPredicate)

    for (const [index, minimum] of courierPredicate.minimums.entries()) {
      const attributes = [...courierPredicate.minimums]

      attributes[index] = minimum - 1n

      const holder = await issueTo(registry, issuer, courierCredential(attributes))

      await assert.rejects(registry.present(randomBytes(32), id, holder), /does not meet the predicate/)
    }
  })

  it("refuses a predicate the issuer never approved", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const holder = await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))
    const unapproved: Predicate = { ...courierPredicate, minimums: [511n, 470n, 230n, issueDay] }

    await assert.rejects(
      registry.present(randomBytes(32), pureCircuits.predicateId(unapproved), holder),
      /the predicate is not approved/
    )
  })

  it("refuses a credential of another class", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const credential: Credential = {
      classId: merchantClass,
      attributes: [999n, 999n, 999n, issueDay],
      salt: randomBytes(32)
    }
    const holder = await issueTo(registry, issuer, credential)

    await assert.rejects(
      registry.present(randomBytes(32), pureCircuits.predicateId(courierPredicate), holder),
      /another class/
    )
  })

  it("answers each challenge once", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const holder = await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))
    const challenge = randomBytes(32)
    const id = pureCircuits.predicateId(courierPredicate)

    await registry.present(challenge, id, holder)

    await assert.rejects(registry.present(challenge, id, holder), /already answered/)
  })

  it("refuses a credential that was never issued", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const issued = await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))
    const forged: HolderPrivateState = { ...issued, credential: courierCredential([900n, 500n, 400n, issueDay]) }

    await assert.rejects(
      registry.present(randomBytes(32), pureCircuits.predicateId(courierPredicate), forged),
      /was not issued/
    )
  })

  it("refuses a holder whose credential index lies beyond the registry", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const issued = await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))
    const beyond: HolderPrivateState = { ...issued, leafIndex: 5n }

    await assert.rejects(
      registry.present(randomBytes(32), pureCircuits.predicateId(courierPredicate), beyond),
      causedBy(/not in the registry/)
    )
  })

  it("keeps each secret with its role", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const holder = await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))

    await assert.rejects(registry.issue(randomBytes(32), holder), causedBy(/only the issuer knows the issuer secret/))
    await assert.rejects(
      registry.present(randomBytes(32), pureCircuits.predicateId(courierPredicate), issuer),
      causedBy(/only a holder holds a credential/)
    )
  })

  it("refuses a revoked credential and still accepts the others", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const revoked = await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))
    const kept = await issueTo(registry, issuer, courierCredential([700n, 480n, 300n, issueDay]))
    const id = pureCircuits.predicateId(courierPredicate)

    await registry.revoke(revoked.leafIndex, issuer)

    await assert.rejects(registry.present(randomBytes(32), id, revoked), /was not issued/)
    await registry.present(randomBytes(32), id, kept)
  })

  it("lets only the issuer revoke", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const holder = await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))

    await assert.rejects(registry.revoke(holder.leafIndex, newIssuer()), /not the issuer/)
    await registry.present(randomBytes(32), pureCircuits.predicateId(courierPredicate), holder)
  })

  it("refuses a withdrawn predicate and keeps what was proven under it", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const holder = await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))
    const id = pureCircuits.predicateId(courierPredicate)
    const answered = randomBytes(32)

    await registry.present(answered, id, holder)
    await registry.withdrawPredicate(id, issuer)

    await assert.rejects(registry.present(randomBytes(32), id, holder), /the predicate is not approved/)
    assert.deepEqual(registry.ledger().presentations.lookup(answered), id)
  })

  it("hands the issuer role over in two steps", async () => {
    const issuer = newIssuer()
    const next = newIssuer()
    const registry = await InMemoryCredentialRegistry.deploy(issuer.issuerSecret)

    await assert.rejects(registry.acceptIssuer(next), /no issuer was proposed/)
    await assert.rejects(
      registry.proposeIssuer(pureCircuits.issuerPublicKey(next.issuerSecret), next),
      /not the issuer/
    )

    await registry.proposeIssuer(pureCircuits.issuerPublicKey(next.issuerSecret), issuer)

    await assert.rejects(registry.acceptIssuer(newIssuer()), /not the proposed issuer/)
    await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))

    await registry.acceptIssuer(next)

    assert.deepEqual(registry.ledger().issuerPk, pureCircuits.issuerPublicKey(next.issuerSecret))
    assert.equal(registry.ledger().proposedIssuerPk.is_some, false)
    await assert.rejects(issueTo(registry, issuer, courierCredential([1n, 1n, 1n, issueDay])), /not the issuer/)
    await issueTo(registry, next, courierCredential([512n, 470n, 230n, issueDay]))
  })

  it("lets only the issuer pause and unpause", async () => {
    const { registry, issuer } = await registryWithPredicate()

    await assert.rejects(registry.pause(newIssuer()), /not the issuer/)
    await registry.pause(issuer)

    assert.equal(registry.ledger().Pausable__isPaused, true)
    await assert.rejects(registry.pause(issuer), /Pausable: paused/)
    await assert.rejects(registry.unpause(newIssuer()), /not the issuer/)

    await registry.unpause(issuer)

    assert.equal(registry.ledger().Pausable__isPaused, false)
    await assert.rejects(registry.unpause(issuer), /Pausable: not paused/)
  })

  it("stops issuing, approving and presenting while paused, and resumes after", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const holder = await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))
    const id = pureCircuits.predicateId(courierPredicate)

    await registry.pause(issuer)

    await assert.rejects(issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay])), /Pausable: paused/)
    await assert.rejects(
      registry.approvePredicate({ ...courierPredicate, minimums: [1n, 0n, 0n, 0n] }, issuer),
      /Pausable: paused/
    )
    await assert.rejects(registry.present(randomBytes(32), id, holder), /Pausable: paused/)

    await registry.unpause(issuer)

    await registry.present(randomBytes(32), id, holder)
  })

  it("still revokes, withdraws and hands the issuer role over while paused", async () => {
    const { registry, issuer } = await registryWithPredicate()
    const holder = await issueTo(registry, issuer, courierCredential([512n, 470n, 230n, issueDay]))
    const next = newIssuer()

    await registry.pause(issuer)

    await registry.revoke(holder.leafIndex, issuer)
    await registry.withdrawPredicate(pureCircuits.predicateId(courierPredicate), issuer)
    await registry.proposeIssuer(pureCircuits.issuerPublicKey(next.issuerSecret), issuer)
    await registry.acceptIssuer(next)

    assert.equal(registry.ledger().predicates.size(), 0n)
    assert.deepEqual(registry.ledger().issuerPk, pureCircuits.issuerPublicKey(next.issuerSecret))
  })
})

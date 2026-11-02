import assert from "node:assert/strict"
import { describe, it } from "node:test"

import CredentialIssuer from "../../src/application/credential_issuer.service.ts"
import type { RegistryGeneration } from "../../src/types/registry_generation.type.ts"
import { credentialRecord } from "../fakes/credential_record.ts"
import FakeCredentialChain from "../fakes/fake_credential_chain.ts"
import FakeCredentialStore from "../fakes/fake_credential_store.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import RecordingCredentialMetrics from "../fakes/recording_credential_metrics.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const first = credentialRecord({ id: "00000000-0000-4000-8000-000000000001", principalId: "drv_1" })
const second = credentialRecord({ id: "00000000-0000-4000-8000-000000000002", principalId: "drv_2" })

function issuerWith(generations: RegistryGeneration[] = [registryGeneration({ generation: 1 })]) {
  const chain = new FakeCredentialChain()
  const store = new FakeCredentialStore()
  const generationStore = new FakeRegistryGenerationStore(generations)
  const metrics = new RecordingCredentialMetrics()
  const logger = new RecordingLogger()
  const issuer = new CredentialIssuer(chain, store, generationStore, metrics, logger, function now(): Date {
    return new Date("2026-11-02T03:00:00Z")
  })

  store.credentials.push(first, second)

  return { chain, store, generationStore, metrics, logger, issuer }
}

describe("the credential issuer", () => {
  it("issues every queued credential into the active registry, in order, and records where each landed", async () => {
    const { chain, store, metrics, issuer } = issuerWith()

    await issuer.settle()

    assert.equal(chain.tree.length, 2)
    assert.equal((await store.issuanceOf(first.id, 1))?.leafIndex, 0n)
    assert.equal((await store.issuanceOf(second.id, 1))?.leafIndex, 1n)
    assert.equal((await store.issuanceOf(second.id, 1))?.txId, "tx-2")
    assert.deepEqual(metrics.issuances, ["issued", "issued"])
  })

  it("does nothing while no generation is active", async () => {
    const { chain, store, issuer } = issuerWith([registryGeneration({ status: "deploying" })])

    await issuer.settle()

    assert.equal(chain.submitted.length, 0)
    assert.equal(store.issuances.length, 0)
  })

  it("stops at a failure, keeps the credential uncertain, and finds it next time if it landed", async () => {
    const { chain, store, metrics, logger, issuer } = issuerWith()

    chain.issueFails = new Error("confirming an issue timed out after 300 s")
    chain.landsDespiteFailure = true

    await issuer.settle()

    assert.equal(chain.submitted.length, 1)
    assert.equal((await store.issuanceOf(first.id, 1))?.status, "uncertain")
    assert.equal((await store.issuanceOf(second.id, 1))?.status, "pending")
    assert.deepEqual(metrics.issuances, ["failed"])
    assert.ok(logger.lines.some((line) => line.message.startsWith("a credential could not be issued")))

    chain.issueFails = undefined
    chain.landsDespiteFailure = false

    await issuer.settle()

    assert.equal(chain.submitted.length, 2)
    assert.equal((await store.issuanceOf(first.id, 1))?.leafIndex, 0n)
    assert.equal((await store.issuanceOf(first.id, 1))?.txId, undefined)
    assert.equal((await store.issuanceOf(second.id, 1))?.leafIndex, 1n)
  })

  it("submits an uncertain credential again when it never landed", async () => {
    const { chain, store, issuer } = issuerWith()

    chain.issueFails = new Error("paying for an issue timed out after 300 s")

    await issuer.settle()

    chain.issueFails = undefined

    await issuer.settle()

    assert.equal(chain.submitted.length, 3)
    assert.deepEqual(chain.tree, [chain.submitted[1], chain.submitted[2]])
    assert.equal((await store.issuanceOf(first.id, 1))?.status, "issued")
  })

  it("leaves a credential uncertain when the registry cannot be read after its issue", async () => {
    const { chain, store, issuer } = issuerWith()

    chain.locateFails = new Error("reading the registry timed out after 300 s")

    await issuer.settle()

    assert.equal((await store.issuanceOf(first.id, 1))?.status, "uncertain")
    assert.equal(chain.tree.length, 1)
  })

  it("issues each holder's current credential again into a new generation", async () => {
    const { store, generationStore, issuer } = issuerWith()
    const older = credentialRecord({
      id: "00000000-0000-4000-8000-000000000003",
      principalId: "drv_1",
      issueDay: 20_700,
      requestedAt: new Date("2026-09-03T00:00:00Z")
    })

    store.credentials.push(older)
    await issuer.settle()

    const [active] = generationStore.rows

    assert.ok(active !== undefined)

    active.status = "retired"
    generationStore.rows.push(registryGeneration({ generation: 2, contractAddress: "02dd" }))

    await issuer.settle()

    assert.equal((await store.issuanceOf(first.id, 2))?.status, "issued")
    assert.equal((await store.issuanceOf(second.id, 2))?.status, "issued")
    assert.equal(await store.issuanceOf(older.id, 2), undefined)
  })

  it("runs one settlement at a time", async () => {
    const { chain, issuer } = issuerWith()

    await Promise.all([issuer.settle(), issuer.settle()])

    assert.equal(chain.submitted.length, 2)
  })
})

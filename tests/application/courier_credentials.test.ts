import assert from "node:assert/strict"
import { describe, it } from "node:test"

import CourierCredentials from "../../src/application/courier_credentials.service.ts"
import { courierClassId } from "../../src/domain/credential_classes.ts"
import type { RegistryGeneration } from "../../src/types/registry_generation.type.ts"
import { credentialRecord } from "../fakes/credential_record.ts"
import FakeCourierFactReader from "../fakes/fake_courier_fact_reader.ts"
import FakeCredentialStore from "../fakes/fake_credential_store.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import RecordingCredentialMetrics from "../fakes/recording_credential_metrics.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const at = new Date("2026-11-02T03:00:00Z")
const courier = { principalId: "drv_1", role: "courier" }
const holderKey = 987_654_321n

function credentialsWith(generations: RegistryGeneration[] = [registryGeneration({})]) {
  const facts = new FakeCourierFactReader(new Date(at.getTime() - 60_000))
  const store = new FakeCredentialStore()
  const metrics = new RecordingCredentialMetrics()
  const credentials = new CourierCredentials(facts, store, new FakeRegistryGenerationStore(generations), metrics, 300)

  facts.summaries.set("drv_1", {
    deliveries: 40,
    firstDeliveredAt: new Date("2026-10-03T09:00:00Z"),
    reviews: 10,
    ratingSum: 47
  })

  return { facts, store, metrics, credentials }
}

describe("requesting a courier credential", () => {
  it("records a snapshot of the courier's facts, bound to the holder's key", async () => {
    const { store, metrics, credentials } = credentialsWith()

    const outcome = await credentials.request(courier, holderKey, at)

    assert.equal(outcome.kind, "accepted")
    assert.equal(store.credentials.length, 1)

    const [credential] = store.credentials

    assert.deepEqual(credential?.attributes, [40n, 470n, 30n, 20_759n])
    assert.deepEqual(credential?.classId, courierClassId)
    assert.equal(credential?.holderPublicKey, holderKey)
    assert.equal(credential?.salt.length, 32)
    assert.deepEqual(metrics.requests, ["accepted"])
  })

  it("answers a repeat from the same holder with the credential it already has", async () => {
    const { facts, store, credentials } = credentialsWith()

    const later = new Date(at.getTime() + 3_600_000)
    const first = await credentials.request(courier, holderKey, at)

    facts.caughtUp = { deliveries: later, reviews: later }

    const again = await credentials.request(courier, holderKey, later)

    assert.ok(first.kind === "accepted" && again.kind === "existing")
    assert.equal(again.credential.id, first.credential.id)
    assert.equal(store.credentials.length, 1)
  })

  it("refuses a second credential on the same day for another holder key", async () => {
    const { credentials } = credentialsWith()

    await credentials.request(courier, holderKey, at)

    assert.equal((await credentials.request(courier, holderKey + 1n, at)).kind, "issued_today")
  })

  it("issues a new one the next day", async () => {
    const { facts, store, credentials } = credentialsWith()
    const tomorrow = new Date("2026-11-03T00:00:01Z")

    await credentials.request(courier, holderKey, at)
    facts.caughtUp = { deliveries: tomorrow, reviews: tomorrow }

    assert.equal((await credentials.request(courier, holderKey + 1n, tomorrow)).kind, "accepted")
    assert.equal(store.credentials.length, 2)
  })

  it("answers the holder that won a race for the day as the existing one", async () => {
    const { store, credentials } = credentialsWith()

    store.conflictOnce = credentialRecord({ holderPublicKey: holderKey, issueDay: 20_759 })

    const outcome = await credentials.request(courier, holderKey, at)

    assert.equal(outcome.kind, "existing")
  })

  it("issues courier credentials to couriers only", async () => {
    const { store, metrics, credentials } = credentialsWith()

    assert.equal(
      (await credentials.request({ principalId: "drv_1", role: "seller" }, holderKey, at)).kind,
      "not_a_courier"
    )

    assert.equal(store.credentials.length, 0)
    assert.deepEqual(metrics.requests, ["not_a_courier"])
  })

  it("issues nothing from facts that are not current", async () => {
    const { facts, store, credentials } = credentialsWith()

    facts.caughtUp = { deliveries: new Date(at.getTime() - 301_000), reviews: at }

    assert.equal((await credentials.request(courier, holderKey, at)).kind, "facts_stale")
    assert.equal(store.credentials.length, 0)
  })

  it("issues nothing to a courier who has delivered nothing", async () => {
    const { store, credentials } = credentialsWith()

    assert.equal(
      (await credentials.request({ principalId: "drv_new", role: "courier" }, holderKey, at)).kind,
      "no_deliveries"
    )

    assert.equal(store.credentials.length, 0)
  })
})

describe("a courier credential's status", () => {
  it("is pending until the issuer has placed it in the active registry", async () => {
    const { credentials } = credentialsWith()
    const outcome = await credentials.request(courier, holderKey, at)

    assert.ok(outcome.kind === "accepted")

    const status = await credentials.status(courier, outcome.credential.id)

    assert.equal(status?.standing, "pending")
    assert.equal(status?.placement, undefined)
  })

  it("names the registry and the leaf index once issued", async () => {
    const { store, credentials } = credentialsWith([registryGeneration({ generation: 3, contractAddress: "02cc" })])
    const outcome = await credentials.request(courier, holderKey, at)

    assert.ok(outcome.kind === "accepted")

    await store.queueCurrent(3)
    await store.markIssued(outcome.credential.id, 3, 41n, "00tx")

    const status = await credentials.status(courier, outcome.credential.id)

    assert.equal(status?.standing, "issued")
    assert.deepEqual(status?.placement, { generation: 3, contractAddress: "02cc", leafIndex: 41n, txId: "00tx" })
  })

  it("is superseded when a newer credential took its place in a new generation", async () => {
    const generations = [registryGeneration({ generation: 2 })]
    const { store, credentials } = credentialsWith(generations)
    const older = credentialRecord({
      id: "00000000-0000-4000-8000-000000000001",
      issueDay: 20_700,
      requestedAt: new Date("2026-09-03T00:00:00Z")
    })

    const newer = credentialRecord({ id: "00000000-0000-4000-8000-000000000002" })

    store.credentials.push(older, newer)

    assert.equal((await credentials.status(courier, older.id))?.standing, "superseded")
    assert.equal((await credentials.status(courier, newer.id))?.standing, "pending")
  })

  it("shows a credential to its holder only", async () => {
    const { credentials } = credentialsWith()
    const outcome = await credentials.request(courier, holderKey, at)

    assert.ok(outcome.kind === "accepted")
    assert.equal(await credentials.status({ principalId: "drv_2", role: "courier" }, outcome.credential.id), undefined)
    assert.equal(await credentials.status(courier, "00000000-0000-4000-8000-00000000ffff"), undefined)
  })

  it("is pending while no registry generation is active", async () => {
    const { credentials } = credentialsWith([registryGeneration({ status: "deploying" })])
    const outcome = await credentials.request(courier, holderKey, at)

    assert.ok(outcome.kind === "accepted")
    assert.equal((await credentials.status(courier, outcome.credential.id))?.standing, "pending")
  })
})

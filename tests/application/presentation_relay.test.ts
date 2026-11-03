import assert from "node:assert/strict"
import { describe, it } from "node:test"

import PresentationRelay from "../../src/application/presentation_relay.service.ts"
import type { RegistryGeneration } from "../../src/types/registry_generation.type.ts"
import FakePresentationInspector from "../fakes/fake_presentation_inspector.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import RecordingPresentationMetrics from "../fakes/recording_presentation_metrics.ts"
import RecordingTransactionPayer from "../fakes/recording_transaction_payer.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const transaction = Uint8Array.from([1, 2, 3])

function relayWith(generations: RegistryGeneration[] = [registryGeneration({ contractAddress: "02cc" })]) {
  const inspector = new FakePresentationInspector()
  const payer = new RecordingTransactionPayer()
  const metrics = new RecordingPresentationMetrics()
  const relay = new PresentationRelay({
    inspector,
    payer,
    generations: new FakeRegistryGenerationStore(generations),
    metrics
  })

  return { inspector, payer, metrics, relay }
}

describe("relaying a presentation", () => {
  it("hands a present call on the active registry to the sponsor, bound as it came", async () => {
    const { payer, metrics, relay } = relayWith()

    assert.deepEqual(await relay.relay(transaction), { kind: "relayed", txId: "00sp1" })
    assert.deepEqual(payer.sponsored, [transaction])
    assert.equal(payer.paid.length, 0)
    assert.deepEqual(metrics.outcomes, ["relayed"])
  })

  it("spends nothing on bytes that are not a presentation", async () => {
    const { inspector, payer, relay } = relayWith()

    inspector.next = undefined

    assert.equal((await relay.relay(transaction)).kind, "not_a_presentation")

    inspector.next = { calls: [{ address: "02dd", entryPoint: "present" }], otherActions: 0, offers: 0 }

    assert.deepEqual(await relay.relay(transaction), {
      kind: "not_a_presentation",
      reason: "the call is not to the active registry"
    })

    assert.equal(payer.sponsored.length, 0)
  })

  it("waits for an active registry", async () => {
    const { payer, relay } = relayWith([registryGeneration({ status: "deploying" })])

    assert.equal((await relay.relay(transaction)).kind, "no_registry")
    assert.equal(payer.sponsored.length, 0)
  })

  it("says the sponsor is unavailable rather than failing the presentation", async () => {
    const { payer, relay } = relayWith()

    payer.failure = new Error("the sponsor answered 503: the sponsor wallet is still syncing")

    assert.deepEqual(await relay.relay(transaction), {
      kind: "sponsor_unavailable",
      reason: "the sponsor answered 503: the sponsor wallet is still syncing"
    })
  })
})

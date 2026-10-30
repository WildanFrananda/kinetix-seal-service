import assert from "node:assert/strict"
import { describe, it } from "node:test"

import RegistryGenerations from "../../src/application/registry_generations.service.ts"
import type { RegistryGeneration } from "../../src/types/registry_generation.type.ts"
import FakeRegistryChain from "../fakes/fake_registry_chain.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import RecordingRegistryGauges from "../fakes/recording_registry_gauges.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const digest = "b".repeat(64)

function generationsWith(rows: RegistryGeneration[]) {
  const chain = new FakeRegistryChain()
  const store = new FakeRegistryGenerationStore(rows)
  const gauges = new RecordingRegistryGauges()
  const logger = new RecordingLogger()
  const generations = new RegistryGenerations(chain, store, gauges, logger, "preprod", digest)

  return { chain, store, gauges, logger, generations }
}

describe("the registry generations", () => {
  it("deploys the first generation and records where its deploy landed", async () => {
    const { chain, store, gauges, generations } = generationsWith([])

    await generations.reconcile()

    assert.deepEqual(chain.submitted, [1])
    assert.equal(store.statusOf(1), "active")
    assert.equal(store.rows[0]?.anchorHeight, 3_300_001)
    assert.equal(store.rows[0]?.buildDigest, digest)
    assert.equal(gauges.generation, 1)
    assert.deepEqual(gauges.deploys, ["succeeded"])
  })

  it("leaves an active generation alone while its anchor block holds", async () => {
    const { chain, gauges, generations } = generationsWith([registryGeneration({ generation: 2 })])

    assert.equal((await generations.reconcile())?.action, "keep")
    assert.deepEqual(chain.prepared, [])
    assert.equal(gauges.generation, 2)
  })

  it("redeploys after a reset seen twice in a row, and not after one sighting", async () => {
    const { chain, store, generations } = generationsWith([registryGeneration({ generation: 2 })])

    chain.anchors = ["replaced", "replaced"]

    assert.equal((await generations.reconcile())?.action, "wait")
    assert.deepEqual(chain.prepared, [])

    assert.equal((await generations.reconcile())?.action, "deploy")
    assert.deepEqual(store.retirements, [{ generation: 2, reason: "chain_reset" }])
    assert.equal(store.statusOf(3), "active")
  })

  it("treats a chain it cannot read as unknown, and waits", async () => {
    const { chain, logger, generations } = generationsWith([registryGeneration({})])

    chain.anchors = [new Error("the indexer answered 503"), new Error("the indexer answered 503")]

    assert.equal((await generations.reconcile())?.action, "wait")
    assert.equal((await generations.reconcile())?.action, "wait")
    assert.deepEqual(chain.prepared, [])
    assert.ok(logger.lines.some((line) => line.message === "the registry's chain could not be observed"))
  })

  it("redeploys when the contract was rebuilt", async () => {
    const { chain, store, generations } = generationsWith([registryGeneration({ buildDigest: "a".repeat(64) })])

    await generations.reconcile()

    assert.deepEqual(store.retirements, [{ generation: 1, reason: "contract_rebuilt" }])
    assert.deepEqual(chain.submitted, [2])
  })

  it("keeps a failed deploy as deploying, then retires it and deploys again", async () => {
    const { chain, store, gauges, generations } = generationsWith([])

    chain.submitFails = new Error("confirming the deploy of generation 1 timed out after 300 s")
    await generations.reconcile()

    assert.equal(store.statusOf(1), "deploying")
    assert.deepEqual(gauges.deploys, ["failed"])

    chain.submitFails = undefined
    await generations.reconcile()

    assert.deepEqual(store.retirements, [{ generation: 1, reason: "interrupted" }])
    assert.equal(store.statusOf(2), "active")
  })

  it("runs one reconciliation at a time", async () => {
    const { chain, generations } = generationsWith([])

    const [first, second] = await Promise.all([generations.reconcile(), generations.reconcile()])

    assert.equal(first?.action, "deploy")
    assert.equal(second, undefined)
    assert.deepEqual(chain.prepared, [1])
  })
})

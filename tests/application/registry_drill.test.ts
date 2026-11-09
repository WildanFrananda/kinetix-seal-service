import assert from "node:assert/strict"
import { describe, it } from "node:test"

import RegistryDrill from "../../src/application/registry_drill.service.ts"
import RegistryGenerations from "../../src/application/registry_generations.service.ts"
import FakeRegistryChain from "../fakes/fake_registry_chain.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import RecordingRegistryGauges from "../fakes/recording_registry_gauges.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

describe("a registry drill", () => {
  it("retires the active generation it is named, as a drill", async () => {
    const store = new FakeRegistryGenerationStore([registryGeneration({ generation: 1 })])

    const outcome = await new RegistryDrill(store).retire(1)

    assert.deepEqual(outcome, { kind: "retired", generation: 1, networkId: "preprod" })
    assert.deepEqual(store.retirements, [{ generation: 1, reason: "drill" }])
  })

  it("refuses a generation that is not the active one, and names the active one", async () => {
    const store = new FakeRegistryGenerationStore([
      registryGeneration({ generation: 1, status: "retired" }),
      registryGeneration({ generation: 2, contractAddress: "0202bb" })
    ])

    const outcome = await new RegistryDrill(store).retire(1)

    assert.deepEqual(outcome, { kind: "refused", reason: "not_the_active_generation", activeGeneration: 2 })
    assert.deepEqual(store.retirements, [])
  })

  it("refuses when no generation is active, so a deploy in flight is left alone", async () => {
    const store = new FakeRegistryGenerationStore([registryGeneration({ generation: 3, status: "deploying" })])

    const outcome = await new RegistryDrill(store).retire(3)

    assert.deepEqual(outcome, { kind: "refused", reason: "no_active_generation", activeGeneration: undefined })
    assert.deepEqual(store.retirements, [])
  })

  it("never drills a generation on mainnet", async () => {
    const store = new FakeRegistryGenerationStore([registryGeneration({ generation: 1, networkId: "mainnet" })])

    const outcome = await new RegistryDrill(store).retire(1)

    assert.deepEqual(outcome, { kind: "refused", reason: "network_not_drillable", activeGeneration: 1 })
    assert.deepEqual(store.retirements, [])
  })

  it("leaves the service's next check to deploy the following generation", async () => {
    const store = new FakeRegistryGenerationStore([registryGeneration({ generation: 1 })])
    const chain = new FakeRegistryChain()
    const generations = new RegistryGenerations(
      chain,
      store,
      new RecordingRegistryGauges(),
      new RecordingLogger(),
      "preprod",
      "b".repeat(64)
    )

    await new RegistryDrill(store).retire(1)

    assert.equal((await generations.reconcile())?.action, "deploy")
    assert.deepEqual(chain.submitted, [2])
    assert.equal(store.statusOf(1), "retired")
    assert.equal(store.statusOf(2), "active")
  })
})

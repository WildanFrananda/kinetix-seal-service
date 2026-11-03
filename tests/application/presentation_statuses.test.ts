import assert from "node:assert/strict"
import { describe, it } from "node:test"

import PresentationStatuses from "../../src/application/presentation_statuses.service.ts"
import type { RegistryGeneration } from "../../src/types/registry_generation.type.ts"
import FakePresentationLedger from "../fakes/fake_presentation_ledger.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

function statusesWith(
  generations: RegistryGeneration[] = [registryGeneration({ generation: 2, contractAddress: "02cc" })]
) {
  const ledger = new FakePresentationLedger()
  const clock = { at: new Date("2026-11-03T03:00:00Z") }
  const statuses = new PresentationStatuses(
    ledger,
    new FakeRegistryGenerationStore(generations),
    5,
    function now(): Date {
      return clock.at
    }
  )

  return { ledger, clock, statuses }
}

describe("a presentation's status", () => {
  it("names the predicate a challenge was answered under, or none", async () => {
    const { ledger, statuses } = statusesWith()

    ledger.answers.set("c1", "p1")

    assert.deepEqual(await statuses.statusOf("c1"), { generation: 2, predicateId: "p1" })
    assert.deepEqual(await statuses.statusOf("c2"), { generation: 2, predicateId: undefined })
  })

  it("reads the registry at most every five seconds, however many verifiers wait", async () => {
    const { ledger, clock, statuses } = statusesWith()

    await Promise.all([statuses.statusOf("a"), statuses.statusOf("b"), statuses.statusOf("c")])
    clock.at = new Date(clock.at.getTime() + 4_999)
    await statuses.statusOf("a")

    assert.deepEqual(ledger.read, ["02cc"])

    clock.at = new Date(clock.at.getTime() + 1)
    await statuses.statusOf("a")

    assert.equal(ledger.read.length, 2)
  })

  it("is unknown while no registry is active", async () => {
    assert.equal(await statusesWith([registryGeneration({ status: "deploying" })]).statuses.statusOf("a"), undefined)
  })
})

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import PredicateKeeper from "../../src/application/predicate_keeper.service.ts"
import { courierClassId } from "../../src/domain/credential_classes.ts"
import type { RegistryGeneration } from "../../src/types/registry_generation.type.ts"
import FakePredicateChain from "../fakes/fake_predicate_chain.ts"
import FakePredicatePlacementStore from "../fakes/fake_predicate_placement_store.ts"
import FakePredicateTemplateStore from "../fakes/fake_predicate_template_store.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import { predicateTemplate } from "../fakes/predicate_template.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import RecordingPredicateMetrics from "../fakes/recording_predicate_metrics.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const tuesday = new Date("2026-11-03T03:00:00Z")

function keeperWith(generations: RegistryGeneration[] = [registryGeneration({ generation: 2 })]) {
  const chain = new FakePredicateChain()
  const templates = new FakePredicateTemplateStore()
  const placements = new FakePredicatePlacementStore()
  const metrics = new RecordingPredicateMetrics()
  const logger = new RecordingLogger()
  const clock = { at: tuesday }
  const keeper = new PredicateKeeper({
    chain,
    templates,
    placements,
    generations: new FakeRegistryGenerationStore(generations),
    metrics,
    logger,
    clock: function now(): Date {
      return clock.at
    },
    periodDays: 7
  })

  return { chain, templates, placements, metrics, logger, clock, keeper }
}

describe("keeping the registry's predicates", () => {
  it("approves this period's and the last period's row of every live template", async () => {
    const { chain, templates, placements, metrics, keeper } = keeperWith()

    templates.templates.push(predicateTemplate({}))
    await keeper.reconcile()

    assert.deepEqual(chain.minimumsOnChain(), ["100,450,90,20718", "100,450,90,20725"])
    assert.equal(placements.generation, 2)
    assert.equal(placements.placed.length, 2)
    assert.deepEqual(metrics.changes, ["approve done", "approve done"])
    assert.equal(metrics.drift, 0)
  })

  it("does nothing when the registry already holds what is approved", async () => {
    const { chain, templates, keeper } = keeperWith()

    templates.templates.push(predicateTemplate({}))
    await keeper.reconcile()
    chain.sent.length = 0
    await keeper.reconcile()

    assert.deepEqual(chain.sent, [])
  })

  it("rolls a period over: approves the new row first, then withdraws the oldest", async () => {
    const { chain, templates, clock, keeper } = keeperWith()

    templates.templates.push(predicateTemplate({}))
    await keeper.reconcile()
    chain.sent.length = 0
    clock.at = new Date("2026-11-06T00:00:00Z")
    await keeper.reconcile()

    assert.deepEqual(chain.sent, ["approve 100,450,90,20732", "withdraw 100,450,90,20718"])
    assert.deepEqual(chain.minimumsOnChain(), ["100,450,90,20725", "100,450,90,20732"])
  })

  it("withdraws every row of a withdrawn template, and rows nobody approved", async () => {
    const { chain, templates, keeper } = keeperWith()
    const template = predicateTemplate({})

    templates.templates.push(template)
    await keeper.reconcile()
    await templates.withdraw(template.id, "adm_1", tuesday)
    chain.place({ classId: courierClassId, minimums: [1n, 1n, 1n, 1n] })
    await keeper.reconcile()

    assert.deepEqual(chain.minimumsOnChain(), [])
  })

  it("stops at the first change that fails, keeps what it saw, and tries again on the next tick", async () => {
    const { chain, templates, placements, metrics, logger, keeper } = keeperWith()

    templates.templates.push(predicateTemplate({}))
    chain.failOn = "approve"
    await keeper.reconcile()

    assert.equal(chain.sent.length, 1)
    assert.deepEqual(metrics.changes, ["approve failed"])
    assert.equal(metrics.drift, 2)
    assert.equal(placements.placed.length, 0)
    assert.match(String(logger.lines.at(-1)?.message), /tried again on the next tick/)

    chain.failOn = undefined
    await keeper.reconcile()

    assert.equal(chain.onChain.size, 2)
    assert.equal(metrics.drift, 0)
  })

  it("waits for an active registry", async () => {
    const { chain, templates, keeper } = keeperWith([registryGeneration({ status: "deploying" })])

    templates.templates.push(predicateTemplate({}))
    await keeper.reconcile()

    assert.deepEqual(chain.sent, [])
  })
})

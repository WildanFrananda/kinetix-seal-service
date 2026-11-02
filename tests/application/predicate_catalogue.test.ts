import assert from "node:assert/strict"
import { describe, it } from "node:test"

import PredicateCatalogue from "../../src/application/predicate_catalogue.service.ts"
import { courierClassId } from "../../src/domain/credential_classes.ts"
import { maxLiveTemplatesPerClass } from "../../src/domain/predicate_limits.ts"
import type { PredicateDraft } from "../../src/types/predicate_draft.type.ts"
import type { RegistryGeneration } from "../../src/types/registry_generation.type.ts"
import FakePredicateChain from "../fakes/fake_predicate_chain.ts"
import FakePredicatePlacementStore from "../fakes/fake_predicate_placement_store.ts"
import FakePredicateTemplateStore from "../fakes/fake_predicate_template_store.ts"
import FakeRegistryGenerationStore from "../fakes/fake_registry_generation_store.ts"
import RecordingLogger from "../fakes/recording_logger.ts"
import { registryGeneration } from "../fakes/registry_generation.ts"

const at = new Date("2026-11-03T03:00:00Z")
const admin = { principalId: "adm_1", role: "admin" }
const courier = { principalId: "drv_1", role: "courier" }
const draft: PredicateDraft = {
  classId: courierClassId,
  label: "Experienced courier",
  minimums: [100n, 450n, 90n],
  freshnessDays: 30
}

function catalogueWith(
  generations: RegistryGeneration[] = [registryGeneration({ generation: 2, contractAddress: "02cc" })]
) {
  const chain = new FakePredicateChain()
  const templates = new FakePredicateTemplateStore()
  const placements = new FakePredicatePlacementStore()
  const logger = new RecordingLogger()
  const catalogue = new PredicateCatalogue({
    chain,
    templates,
    placements,
    generations: new FakeRegistryGenerationStore(generations),
    logger,
    periodDays: 7
  })

  return { chain, templates, placements, logger, catalogue }
}

describe("approving predicates", () => {
  it("records an admin's approval and names its registry rows, not yet placed", async () => {
    const { templates, logger, catalogue } = catalogueWith()
    const outcome = await catalogue.approve(admin, draft, at)

    assert.ok(outcome.kind === "approved")
    assert.equal(outcome.standing.template.approvedBy, "adm_1")
    assert.deepEqual(
      outcome.standing.rows.map((row) => [row.minimumIssueDay, row.current, row.placed]),
      [
        [20_725, true, false],
        [20_718, false, false]
      ]
    )

    assert.equal(templates.templates.length, 1)
    assert.equal(logger.lines.at(-1)?.message, "a predicate was approved")
  })

  it("is for admins only", async () => {
    const { templates, catalogue } = catalogueWith()

    assert.equal((await catalogue.approve(courier, draft, at)).kind, "not_admin")
    assert.equal(await catalogue.withdraw(courier, "00000000-0000-4000-8000-0000000000a1", at), "not_admin")
    assert.equal(templates.templates.length, 0)
  })

  it("refuses a second live template with the same minimums, and one past the limit", async () => {
    const { catalogue } = catalogueWith()

    await catalogue.approve(admin, draft, at)

    assert.equal((await catalogue.approve(admin, draft, at)).kind, "duplicate")

    for (let index = 1; index < maxLiveTemplatesPerClass; index += 1) {
      await catalogue.approve(admin, { ...draft, minimums: [BigInt(index), 0n, 0n] }, at)
    }

    assert.equal((await catalogue.approve(admin, { ...draft, minimums: [999n, 0n, 0n] }, at)).kind, "full")
  })

  it("withdraws once, and answers a repeat without a second audit line", async () => {
    const { logger, catalogue } = catalogueWith()
    const outcome = await catalogue.approve(admin, draft, at)

    assert.ok(outcome.kind === "approved")

    const { id } = outcome.standing.template

    assert.equal(await catalogue.withdraw(admin, id, at), "withdrawn")
    assert.equal(await catalogue.withdraw(admin, id, at), "already_withdrawn")
    assert.equal(logger.lines.filter((line) => line.message === "a predicate was withdrawn").length, 1)
    assert.equal(await catalogue.withdraw(admin, "00000000-0000-4000-8000-00000000ffff", at), "absent")
    assert.deepEqual((await catalogue.standing(id, at))?.rows, [])
  })
})

describe("the public list of predicates", () => {
  it("names the active registry and marks the rows it already holds", async () => {
    const { chain, placements, catalogue } = catalogueWith()
    const outcome = await catalogue.approve(admin, draft, at)

    assert.ok(outcome.kind === "approved")

    const [current] = outcome.standing.rows

    assert.ok(current !== undefined)
    await placements.replace(2, [{ id: chain.predicateIdOf(current.predicate), predicate: current.predicate }], at)

    const listing = await catalogue.listing(at)

    assert.deepEqual(listing.registry, { generation: 2, contractAddress: "02cc" })
    assert.deepEqual(
      listing.standings[0]?.rows.map((row) => row.placed),
      [true, false]
    )
  })

  it("lists only live templates, and nothing as placed without an active registry", async () => {
    const { catalogue } = catalogueWith([registryGeneration({ status: "deploying" })])
    const first = await catalogue.approve(admin, draft, at)

    await catalogue.approve(admin, { ...draft, minimums: [1n, 0n, 0n] }, at)
    assert.ok(first.kind === "approved")
    await catalogue.withdraw(admin, first.standing.template.id, at)

    const listing = await catalogue.listing(at)

    assert.equal(listing.registry, undefined)
    assert.equal(listing.standings.length, 1)
    assert.ok(listing.standings.every((standing) => standing.rows.every((row) => !row.placed)))
  })
})

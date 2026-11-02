import assert from "node:assert/strict"
import { after, beforeEach, describe, it } from "node:test"

import { courierClassId } from "../../src/domain/credential_classes.ts"
import { createPrismaClient } from "../../src/infrastructure/postgres/prisma_client.ts"
import PrismaPredicatePlacementStore from "../../src/infrastructure/postgres/prisma_predicate_placement_store.adapter.ts"
import PrismaPredicateTemplateStore from "../../src/infrastructure/postgres/prisma_predicate_template_store.adapter.ts"
import { predicateTemplate } from "../fakes/predicate_template.ts"

const databaseUrl = process.env.KINETIX_SEAL_TEST_DATABASE_URL

if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("KINETIX_SEAL_TEST_DATABASE_URL is required: a skipped database test proves nothing")
}

const prisma = createPrismaClient(databaseUrl)
const templates = new PrismaPredicateTemplateStore(prisma)
const placements = new PrismaPredicatePlacementStore(prisma)
const at = new Date("2026-11-03T03:00:00Z")

function uuidOf(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
}

after(async () => {
  await prisma.$disconnect()
})

describe("predicate templates in Postgres", () => {
  beforeEach(async () => {
    await prisma.predicateTemplate.deleteMany()
  })

  it("keeps a template whole and lists the live ones in the order they were approved", async () => {
    const first = predicateTemplate({ id: uuidOf(1), label: "Kurir berpengalaman" })
    const second = predicateTemplate({ id: uuidOf(2), minimums: [0n, 0n, 0n], approvedAt: new Date(at.getTime() + 1) })

    assert.equal(await templates.approve(second, 8), "approved")
    assert.equal(await templates.approve(first, 8), "approved")
    assert.deepEqual(await templates.byId(first.id), first)
    assert.deepEqual(
      (await templates.live()).map((template) => template.id),
      [first.id, second.id]
    )
  })

  it("refuses a live duplicate and a class past its limit, also when admins race", async () => {
    const outcomes = await Promise.all(
      [1, 2, 3].map((index) => templates.approve(predicateTemplate({ id: uuidOf(index) }), 8))
    )

    assert.deepEqual(outcomes.sort(), ["approved", "duplicate", "duplicate"])

    const racing = await Promise.all(
      [4, 5, 6].map((index) =>
        templates.approve(predicateTemplate({ id: uuidOf(index), minimums: [BigInt(index), 0n, 0n] }), 3)
      )
    )

    assert.deepEqual(racing.sort(), ["approved", "approved", "full"])
  })

  it("withdraws once, keeps who withdrew it, and allows the same minimums again after", async () => {
    const template = predicateTemplate({ id: uuidOf(1) })

    await templates.approve(template, 8)

    assert.equal(await templates.withdraw(template.id, "adm_2", at), "withdrawn")
    assert.equal(await templates.withdraw(template.id, "adm_3", at), "already_withdrawn")
    assert.equal(await templates.withdraw(uuidOf(9), "adm_2", at), "absent")
    assert.equal((await templates.byId(template.id))?.withdrawnBy, "adm_2")
    assert.deepEqual(await templates.live(), [])
    assert.equal(await templates.approve(predicateTemplate({ id: uuidOf(2) }), 8), "approved")
  })
})

describe("the registry's predicates as last read, in Postgres", () => {
  beforeEach(async () => {
    await prisma.predicatePlacement.deleteMany()
  })

  it("replaces what it held with what the registry holds now", async () => {
    const one = {
      id: new Uint8Array(32).fill(1),
      predicate: { classId: courierClassId, minimums: [1n, 2n, 3n, 20_725n] }
    }

    const two = {
      id: new Uint8Array(32).fill(2),
      predicate: { classId: courierClassId, minimums: [4n, 5n, 6n, 20_718n] }
    }

    await placements.replace(1, [one, two], at)
    await placements.replace(2, [two], at)

    assert.deepEqual(await placements.ofGeneration(2), [two])
    assert.deepEqual(await placements.ofGeneration(1), [])

    await placements.replace(2, [], at)

    assert.deepEqual(await placements.ofGeneration(2), [])
  })
})

import assert from "node:assert/strict"
import { after, beforeEach, describe, it } from "node:test"

import { createPrismaClient } from "../../src/infrastructure/postgres/prisma_client.ts"
import PrismaDatabaseProbe from "../../src/infrastructure/postgres/prisma_database_probe.adapter.ts"
import PrismaSponsorEventStore from "../../src/infrastructure/postgres/prisma_sponsor_event_store.adapter.ts"

const databaseUrl = process.env.KINETIX_SEAL_TEST_DATABASE_URL

if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("KINETIX_SEAL_TEST_DATABASE_URL is required: a skipped database test proves nothing")
}

const prisma = createPrismaClient(databaseUrl)
const store = new PrismaSponsorEventStore(prisma)

describe("sponsor events in Postgres", () => {
  beforeEach(async () => {
    await prisma.sponsorEvent.deleteMany()
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it("has no latest event in an empty table", async () => {
    assert.equal(await store.latest(), undefined)
  })

  it("keeps a DUST balance beyond what a JavaScript number holds exactly", async () => {
    const dustBalance = 1_378_852_929_999_996_996n

    await store.record({
      occurredAt: new Date("2026-10-22T05:21:49Z"),
      condition: "healthy",
      dustBalance,
      dustCoins: 11,
      nightUtxos: 10
    })

    const latest = await store.latest()

    assert.equal(latest?.dustBalance, dustBalance)
    assert.equal(latest?.dustCoins, 11)
  })

  it("returns the newest event", async () => {
    await store.record({
      occurredAt: new Date("2026-10-22T01:00:00Z"),
      condition: "healthy",
      dustBalance: 5n,
      dustCoins: 1,
      nightUtxos: 1
    })
    await store.record({
      occurredAt: new Date("2026-10-22T02:00:00Z"),
      condition: "no_dust",
      dustBalance: 0n,
      dustCoins: 0,
      nightUtxos: 1
    })

    assert.equal((await store.latest())?.condition, "no_dust")
  })

  it("answers the readiness probe with a real query", async () => {
    assert.equal(await new PrismaDatabaseProbe(prisma).reachable(), true)
  })
})

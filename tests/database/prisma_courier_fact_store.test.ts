import assert from "node:assert/strict"
import { after, beforeEach, describe, it } from "node:test"

import { createPrismaClient } from "../../src/infrastructure/postgres/prisma_client.ts"
import PrismaCourierFactStore from "../../src/infrastructure/postgres/prisma_courier_fact_store.adapter.ts"
import { cursorAt, delivery, review } from "../fakes/fact_records.ts"

const databaseUrl = process.env.KINETIX_SEAL_TEST_DATABASE_URL

if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("KINETIX_SEAL_TEST_DATABASE_URL is required: a skipped database test proves nothing")
}

const prisma = createPrismaClient(databaseUrl)
const store = new PrismaCourierFactStore(prisma)

describe("courier facts in Postgres", () => {
  beforeEach(async () => {
    await prisma.courierDelivery.deleteMany()
    await prisma.driverReview.deleteMany()
    await prisma.feedCursor.updateMany({ data: { throughTransaction: 0n, throughSequence: 0n } })
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it("starts both feeds at the beginning, as the migration seeds them", async () => {
    assert.deepEqual(await store.cursor("deliveries"), cursorAt(0, 0))
    assert.deepEqual(await store.cursor("reviews"), cursorAt(0, 0))
  })

  it("keeps a page of deliveries and its cursor together", async () => {
    await store.recordDeliveries(cursorAt(0, 0), cursorAt(5, 2), [delivery(5, 1), delivery(5, 2, "drv_2")])

    assert.deepEqual(await store.cursor("deliveries"), cursorAt(5, 2))
    assert.equal(await prisma.courierDelivery.count({ where: { driverPrincipalId: "drv_1" } }), 1)
    assert.equal(await prisma.courierDelivery.count(), 2)
  })

  it("keeps a cursor position beyond what a JavaScript number holds", async () => {
    const far = { transactionId: 9_007_199_254_740_993n, sequence: 3n }

    await store.recordDeliveries(cursorAt(0, 0), far, [])

    assert.deepEqual(await store.cursor("deliveries"), far)
  })

  it("refuses a page whose cursor has moved, and keeps nothing of it", async () => {
    await store.recordDeliveries(cursorAt(0, 0), cursorAt(5, 1), [delivery(5, 1)])

    await assert.rejects(
      store.recordDeliveries(cursorAt(0, 0), cursorAt(5, 2), [delivery(5, 2)]),
      /the deliveries cursor moved under this page/
    )
    assert.equal(await prisma.courierDelivery.count(), 1)
    assert.deepEqual(await store.cursor("deliveries"), cursorAt(5, 1))
  })

  it("keeps one row per delivered order, whatever the feed repeats", async () => {
    await store.recordDeliveries(cursorAt(0, 0), cursorAt(5, 1), [delivery(5, 1)])
    await store.recordDeliveries(cursorAt(5, 1), cursorAt(6, 0), [{ ...delivery(6, 0), orderNumber: "KX-5-1" }])

    assert.equal(await prisma.courierDelivery.count(), 1)
  })

  it("keeps driver reviews against the courier they rate", async () => {
    await store.recordDriverReviews(cursorAt(0, 0), cursorAt(7, 2), [review(7, 2, "driver", 4)])

    const kept = await prisma.driverReview.findUnique({ where: { reviewId: "rev-7-2" } })

    assert.equal(kept?.driverPrincipalId, "drv_1")
    assert.equal(kept?.rating, 4)
    assert.deepEqual(await store.cursor("reviews"), cursorAt(7, 2))
  })
})

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
    await prisma.feedCursor.updateMany({ data: { throughTransaction: 0n, throughSequence: 0n, caughtUpAt: null } })
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it("starts both feeds at the beginning, as the migration seeds them", async () => {
    assert.deepEqual(await store.cursor("deliveries"), cursorAt(0, 0))
    assert.deepEqual(await store.cursor("reviews"), cursorAt(0, 0))
  })

  it("keeps a page of deliveries and its cursor together", async () => {
    await store.recordDeliveries(cursorAt(0, 0), cursorAt(5, 2), [delivery(5, 1), delivery(5, 2, "drv_2")], false)

    assert.deepEqual(await store.cursor("deliveries"), cursorAt(5, 2))
    assert.equal(await prisma.courierDelivery.count({ where: { driverPrincipalId: "drv_1" } }), 1)
    assert.equal(await prisma.courierDelivery.count(), 2)
  })

  it("keeps a cursor position beyond what a JavaScript number holds", async () => {
    const far = { transactionId: 9_007_199_254_740_993n, sequence: 3n }

    await store.recordDeliveries(cursorAt(0, 0), far, [], false)

    assert.deepEqual(await store.cursor("deliveries"), far)
  })

  it("refuses a page whose cursor has moved, and keeps nothing of it", async () => {
    await store.recordDeliveries(cursorAt(0, 0), cursorAt(5, 1), [delivery(5, 1)], false)

    await assert.rejects(
      store.recordDeliveries(cursorAt(0, 0), cursorAt(5, 2), [delivery(5, 2)], true),
      /the deliveries cursor moved under this page/
    )
    assert.equal(await prisma.courierDelivery.count(), 1)
    assert.deepEqual(await store.cursor("deliveries"), cursorAt(5, 1))
  })

  it("keeps one row per delivered order, whatever the feed repeats", async () => {
    await store.recordDeliveries(cursorAt(0, 0), cursorAt(5, 1), [delivery(5, 1)], false)
    await store.recordDeliveries(cursorAt(5, 1), cursorAt(6, 0), [{ ...delivery(6, 0), orderNumber: "KX-5-1" }], false)

    assert.equal(await prisma.courierDelivery.count(), 1)
  })

  it("keeps driver reviews against the courier they rate", async () => {
    await store.recordDriverReviews(cursorAt(0, 0), cursorAt(7, 2), [review(7, 2, "driver", 4)], false)

    const kept = await prisma.driverReview.findUnique({ where: { reviewId: "rev-7-2" } })

    assert.equal(kept?.driverPrincipalId, "drv_1")
    assert.equal(kept?.rating, 4)
    assert.deepEqual(await store.cursor("reviews"), cursorAt(7, 2))
  })

  it("has caught up with neither feed until a page says there is no more", async () => {
    await store.recordDeliveries(cursorAt(0, 0), cursorAt(5, 1), [delivery(5, 1)], false)

    assert.deepEqual(await store.catchUp(), { deliveries: undefined, reviews: undefined })

    const before = Date.now()

    await store.recordDeliveries(cursorAt(5, 1), cursorAt(5, 1), [], true)

    const catchUp = await store.catchUp()

    assert.ok((catchUp.deliveries?.getTime() ?? 0) >= before - 1000)
    assert.equal(catchUp.reviews, undefined)
  })

  it("keeps the last catch-up when a later page is behind again", async () => {
    await store.recordDriverReviews(cursorAt(0, 0), cursorAt(7, 2), [], true)

    const caughtUp = (await store.catchUp()).reviews

    await store.recordDriverReviews(cursorAt(7, 2), cursorAt(8, 0), [review(8, 0, "driver")], false)

    assert.deepEqual((await store.catchUp()).reviews, caughtUp)
  })

  it("sums a courier's deliveries and ratings, and no one else's", async () => {
    await store.recordDeliveries(
      cursorAt(0, 0),
      cursorAt(5, 3),
      [{ ...delivery(5, 1), deliveredAt: new Date("2026-09-01T10:00:00Z") }, delivery(5, 2), delivery(5, 3, "drv_2")],
      true
    )
    await store.recordDriverReviews(
      cursorAt(0, 0),
      cursorAt(7, 3),
      [review(7, 1, "driver", 5), review(7, 2, "driver", 4), { ...review(7, 3, "driver", 1), subjectId: "drv_2" }],
      true
    )

    assert.deepEqual(await store.summaryOf("drv_1"), {
      deliveries: 2,
      firstDeliveredAt: new Date("2026-09-01T10:00:00Z"),
      reviews: 2,
      ratingSum: 9
    })
  })

  it("reads a courier with no facts as none, not as a failure", async () => {
    assert.deepEqual(await store.summaryOf("drv_unknown"), {
      deliveries: 0,
      firstDeliveredAt: undefined,
      reviews: 0,
      ratingSum: 0
    })
  })
})

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import CourierFacts from "../../src/application/courier_facts.service.ts"
import FeedCallFailure from "../../src/domain/feed_call_failure.ts"
import { cursorAt, delivery, review } from "../fakes/fact_records.ts"
import FakeCourierFactStore from "../fakes/fake_courier_fact_store.ts"
import FakeDeliveryFeed from "../fakes/fake_delivery_feed.ts"
import FakeReviewFeed from "../fakes/fake_review_feed.ts"
import RecordingFeedMetrics from "../fakes/recording_feed_metrics.ts"
import RecordingLogger from "../fakes/recording_logger.ts"

function factsWith(pagesPerTick = 20) {
  const deliveries = new FakeDeliveryFeed()
  const reviews = new FakeReviewFeed()
  const store = new FakeCourierFactStore()
  const metrics = new RecordingFeedMetrics()
  const logger = new RecordingLogger()
  const facts = new CourierFacts(deliveries, reviews, store, metrics, logger, { pageSize: 3, pagesPerTick })

  return { deliveries, reviews, store, metrics, logger, facts }
}

describe("the courier facts", () => {
  it("reads every page of deliveries, moving the cursor page by page", async () => {
    const { deliveries, store, metrics, facts } = factsWith()

    deliveries.pages.push(
      { records: [delivery(5, 1), delivery(5, 2)], next: cursorAt(5, 2), hasMore: true },
      { records: [delivery(6, 0)], next: cursorAt(6, 0), hasMore: false }
    )

    await facts.drain()

    assert.equal(store.deliveries.length, 3)
    assert.deepEqual(store.cursors.get("deliveries"), cursorAt(6, 0))
    assert.deepEqual(deliveries.asked, [cursorAt(0, 0), cursorAt(5, 2)])
    assert.equal(metrics.records.get("deliveries"), 3)
  })

  it("keeps driver reviews only, and still moves past product reviews", async () => {
    const { reviews, store, facts } = factsWith()

    reviews.pages.push({
      records: [review(7, 1, "product"), review(7, 2, "driver", 4), review(7, 3, "other")],
      next: cursorAt(7, 3),
      hasMore: false
    })

    await facts.drain()

    assert.deepEqual(
      store.reviews.map((kept) => kept.reviewId),
      ["rev-7-2"]
    )
    assert.deepEqual(store.cursors.get("reviews"), cursorAt(7, 3))
  })

  it("stops after its pages per tick and resumes on the next tick", async () => {
    const { deliveries, store, facts } = factsWith(1)

    deliveries.pages.push(
      { records: [delivery(5, 1)], next: cursorAt(5, 1), hasMore: true },
      { records: [delivery(5, 2)], next: cursorAt(5, 2), hasMore: false }
    )

    await facts.drain()
    assert.deepEqual(store.cursors.get("deliveries"), cursorAt(5, 1))

    await facts.drain()
    assert.deepEqual(store.cursors.get("deliveries"), cursorAt(5, 2))
  })

  it("refuses a page that breaks the feed's rules, and keeps the cursor", async () => {
    const { deliveries, store, metrics, logger, facts } = factsWith()

    deliveries.pages.push({ records: [delivery(5, 1)], next: cursorAt(9, 9), hasMore: false })

    await facts.drain()

    assert.deepEqual(store.cursors.get("deliveries"), cursorAt(0, 0))
    assert.deepEqual(metrics.failures, [{ stream: "deliveries", kind: "invalid_page" }])
    assert.ok(logger.lines.some((line) => line.message === "a fact feed stopped short"))
  })

  it("reads the reviews even when the deliveries are unavailable", async () => {
    const { deliveries, reviews, store, metrics, logger, facts } = factsWith()

    deliveries.pages.push(new FeedCallFailure("unavailable", "matching could not be reached: 14 UNAVAILABLE"))
    reviews.pages.push({ records: [review(7, 1, "driver")], next: cursorAt(7, 1), hasMore: false })

    await facts.drain()

    assert.equal(store.reviews.length, 1)
    assert.deepEqual(metrics.failures, [{ stream: "deliveries", kind: "unavailable" }])
    assert.ok(logger.lines.some((line) => line.message.includes("read again on the next tick")))
  })

  it("names a refusal as such, and a database failure as the store's", async () => {
    const { deliveries, reviews, store, metrics, facts } = factsWith()

    deliveries.pages.push(new FeedCallFailure("refused", "matching refused the call: 7 PERMISSION_DENIED"))
    reviews.pages.push({ records: [review(7, 1, "driver")], next: cursorAt(7, 1), hasMore: false })
    store.failNext = new Error("connection terminated")

    await facts.drain()

    assert.deepEqual(metrics.failures, [
      { stream: "deliveries", kind: "refused" },
      { stream: "reviews", kind: "store" }
    ])
    assert.deepEqual(store.cursors.get("reviews"), cursorAt(0, 0))
  })

  it("runs one drain at a time", async () => {
    const { deliveries, facts } = factsWith()

    await Promise.all([facts.drain(), facts.drain()])

    assert.equal(deliveries.asked.length, 1)
  })
})

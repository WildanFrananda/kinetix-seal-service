import assert from "node:assert/strict"
import { describe, it } from "node:test"
import DeliveredOrders from "../../src/application/delivered_orders.service.ts"
import type { DeliveredOrderStorePort } from "../../src/application/ports/delivered_order_store.port.ts"
import type { OrderLifecycleFeedPort } from "../../src/application/ports/order_lifecycle_feed.port.ts"
import FeedCallFailure from "../../src/domain/feed_call_failure.ts"
import type { DeliveredOrder } from "../../src/types/delivered_order.type.ts"
import type { FeedPage } from "../../src/types/feed_page.type.ts"
import type { LogCursor } from "../../src/types/log_cursor.type.ts"
import type { OrderLifecycleRecord } from "../../src/types/order_lifecycle_record.type.ts"
import RecordingFeedMetrics from "../fakes/recording_feed_metrics.ts"
import RecordingLogger from "../fakes/recording_logger.ts"

function cursor(transactionId: number, sequence: number): LogCursor {
  return { transactionId: BigInt(transactionId), sequence: BigInt(sequence) }
}

const delivered: DeliveredOrder = {
  orderNumber: "ORD-20261108-8AA3A287",
  buyerPrincipalId: "buy_1",
  merchantPrincipalId: "mer_1",
  deliveredAt: new Date("2026-11-08T10:00:00Z")
}

class ScriptedFeed implements OrderLifecycleFeedPort {
  readonly pages: Array<FeedPage<OrderLifecycleRecord> | Error> = []

  async eventsSince(): Promise<FeedPage<OrderLifecycleRecord>> {
    const next = this.pages.shift()

    if (next === undefined) {
      return { records: [], next: cursor(0, 0), hasMore: false }
    }

    if (next instanceof Error) {
      throw next
    }

    return next
  }
}

class MemoryStore implements DeliveredOrderStorePort {
  position = cursor(0, 0)
  readonly orders: DeliveredOrder[] = []

  async cursor(): Promise<LogCursor> {
    return this.position
  }

  async recordDelivered(_from: LogCursor, next: LogCursor, orders: DeliveredOrder[]): Promise<void> {
    this.position = next
    this.orders.push(...orders)
  }
}

describe("the delivered orders", () => {
  it("keep only the deliveries from order's lifecycle log, and move past every other event", async () => {
    const feed = new ScriptedFeed()
    const store = new MemoryStore()
    const metrics = new RecordingFeedMetrics()

    feed.pages.push({
      records: [
        { position: cursor(10, 1), delivery: undefined },
        { position: cursor(10, 2), delivery: delivered },
        { position: cursor(11, 1), delivery: undefined }
      ],
      next: cursor(11, 1),
      hasMore: false
    })

    await new DeliveredOrders(feed, store, metrics, new RecordingLogger(), { pageSize: 50, pagesPerTick: 3 }).drain()

    assert.deepEqual(store.orders, [delivered])
    assert.deepEqual(store.position, cursor(11, 1))
  })

  it("refuses a page whose cursor does not end at its last event", async () => {
    const feed = new ScriptedFeed()
    const store = new MemoryStore()
    const metrics = new RecordingFeedMetrics()
    const logger = new RecordingLogger()

    feed.pages.push({
      records: [{ position: cursor(10, 2), delivery: delivered }],
      next: cursor(12, 1),
      hasMore: false
    })

    await new DeliveredOrders(feed, store, metrics, logger, { pageSize: 50, pagesPerTick: 3 }).drain()

    assert.deepEqual(store.orders, [])
    assert.deepEqual(store.position, cursor(0, 0))
    assert.ok(logger.lines.some((line) => line.message === "a fact feed stopped short"))
  })

  it("waits for an order service that cannot be reached", async () => {
    const feed = new ScriptedFeed()
    const logger = new RecordingLogger()

    feed.pages.push(new FeedCallFailure("unavailable", "order could not be reached: connect ECONNREFUSED"))

    await new DeliveredOrders(feed, new MemoryStore(), new RecordingFeedMetrics(), logger, {
      pageSize: 50,
      pagesPerTick: 3
    }).drain()

    assert.ok(logger.lines.some((line) => line.message.startsWith("a fact feed is unavailable")))
  })
})

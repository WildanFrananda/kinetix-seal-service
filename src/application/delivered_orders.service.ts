import type { DeliveredOrder } from "../types/delivered_order.type.ts"
import type { FeedLimits } from "../types/feed_limits.type.ts"
import { drainFeedStream } from "./drain_feed.ts"
import type { DeliveredOrderStorePort } from "./ports/delivered_order_store.port.ts"
import type { FeedMetricsPort } from "./ports/feed_metrics.port.ts"
import type { LoggerPort } from "./ports/logger.port.ts"
import type { OrderLifecycleFeedPort } from "./ports/order_lifecycle_feed.port.ts"

class DeliveredOrders {
  private readonly feed: OrderLifecycleFeedPort
  private readonly store: DeliveredOrderStorePort
  private readonly metrics: FeedMetricsPort
  private readonly logger: LoggerPort
  private readonly limits: FeedLimits
  private running = false

  constructor(
    feed: OrderLifecycleFeedPort,
    store: DeliveredOrderStorePort,
    metrics: FeedMetricsPort,
    logger: LoggerPort,
    limits: FeedLimits
  ) {
    this.feed = feed
    this.store = store
    this.metrics = metrics
    this.logger = logger
    this.limits = limits
  }

  async drain(): Promise<void> {
    if (this.running) {
      return
    }

    this.running = true

    try {
      const { store, feed } = this

      await drainFeedStream({
        stream: "orders",
        limits: this.limits,
        metrics: this.metrics,
        logger: this.logger,
        cursor: function () {
          return store.cursor()
        },
        fetch: function (after, limit) {
          return feed.eventsSince(after, limit)
        },
        record: async function (after, page) {
          const deliveries = page.records.flatMap((record): DeliveredOrder[] =>
            record.delivery === undefined ? [] : [record.delivery]
          )

          await store.recordDelivered(after, page.next, deliveries, !page.hasMore)

          return deliveries.length
        }
      })
    } finally {
      this.running = false
    }
  }
}

export default DeliveredOrders

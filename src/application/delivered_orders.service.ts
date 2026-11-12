import FeedCallFailure from "../domain/feed_call_failure.ts"
import { feedPageViolation } from "../domain/feed_page_violation.ts"
import type { DeliveredOrder } from "../types/delivered_order.type.ts"
import type { FeedLimits } from "../types/feed_limits.type.ts"
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
      for (let pages = 0; pages < this.limits.pagesPerTick; pages += 1) {
        const more = await this.pull().catch((error: unknown) => {
          this.failed(error)

          return false
        })

        if (!more) {
          return
        }
      }
    } finally {
      this.running = false
    }
  }

  private async pull(): Promise<boolean> {
    const after = await this.store.cursor()
    const page = await this.feed.eventsSince(after, this.limits.pageSize)
    const violation = feedPageViolation(after, this.limits.pageSize, page)

    if (violation !== undefined) {
      throw new FeedCallFailure("invalid_page", violation)
    }

    const deliveries = page.records.flatMap((record): DeliveredOrder[] =>
      record.delivery === undefined ? [] : [record.delivery]
    )

    await this.store.recordDelivered(after, page.next, deliveries, !page.hasMore)
    this.metrics.recorded("orders", deliveries.length)

    return page.hasMore
  }

  private failed(error: unknown): void {
    const kind = error instanceof FeedCallFailure ? error.kind : "store"

    this.metrics.failed("orders", kind)

    if (kind === "unavailable") {
      this.logger.warn({
        message: "a fact feed is unavailable; it is read again on the next tick",
        fields: { stream: "orders", cause: error instanceof Error ? error.message : String(error) }
      })

      return
    }

    this.logger.error({ message: "a fact feed stopped short", fields: { stream: "orders", kind } }, error)
  }
}

export default DeliveredOrders

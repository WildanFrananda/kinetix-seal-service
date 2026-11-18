import type { FeedLimits } from "../types/feed_limits.type.ts"
import type { FeedStream } from "../types/feed_stream.type.ts"
import { drainFeedStream } from "./drain_feed.ts"
import type { CourierFactStorePort } from "./ports/courier_fact_store.port.ts"
import type { DeliveryFeedPort } from "./ports/delivery_feed.port.ts"
import type { FeedMetricsPort } from "./ports/feed_metrics.port.ts"
import type { LoggerPort } from "./ports/logger.port.ts"
import type { ReviewFeedPort } from "./ports/review_feed.port.ts"

const streams: readonly FeedStream[] = ["deliveries", "reviews"]

class CourierFacts {
  private readonly deliveries: DeliveryFeedPort
  private readonly reviews: ReviewFeedPort
  private readonly store: CourierFactStorePort
  private readonly metrics: FeedMetricsPort
  private readonly logger: LoggerPort
  private readonly limits: FeedLimits
  private running = false

  constructor(
    deliveries: DeliveryFeedPort,
    reviews: ReviewFeedPort,
    store: CourierFactStorePort,
    metrics: FeedMetricsPort,
    logger: LoggerPort,
    limits: FeedLimits
  ) {
    this.deliveries = deliveries
    this.reviews = reviews
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
      for (const stream of streams) {
        await this.drainStream(stream)
      }
    } finally {
      this.running = false
    }
  }

  private async drainStream(stream: FeedStream): Promise<void> {
    const { store, deliveries, reviews } = this

    if (stream === "deliveries") {
      await drainFeedStream({
        stream,
        limits: this.limits,
        metrics: this.metrics,
        logger: this.logger,
        cursor: function () {
          return store.cursor(stream)
        },
        fetch: function (after, limit) {
          return deliveries.deliveriesSince(after, limit)
        },
        record: async function (after, page) {
          await store.recordDeliveries(after, page.next, page.records, !page.hasMore)

          return page.records.length
        }
      })

      return
    }

    await drainFeedStream({
      stream,
      limits: this.limits,
      metrics: this.metrics,
      logger: this.logger,
      cursor: function () {
        return store.cursor(stream)
      },
      fetch: function (after, limit) {
        return reviews.reviewsSince(after, limit)
      },
      record: async function (after, page) {
        const driverReviews = page.records.filter((review) => review.kind === "driver")

        await store.recordDriverReviews(after, page.next, driverReviews, !page.hasMore)

        return driverReviews.length
      }
    })
  }
}

export default CourierFacts

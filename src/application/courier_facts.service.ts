import FeedCallFailure from "../domain/feed_call_failure.ts"
import { feedPageViolation } from "../domain/feed_page_violation.ts"
import type { FeedLimits } from "../types/feed_limits.type.ts"
import type { FeedPage } from "../types/feed_page.type.ts"
import type { FeedStream } from "../types/feed_stream.type.ts"
import type { LogCursor } from "../types/log_cursor.type.ts"
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
    for (let pages = 0; pages < this.limits.pagesPerTick; pages += 1) {
      const more = await this.pull(stream).catch((error: unknown) => {
        this.failed(stream, error)

        return false
      })

      if (!more) {
        return
      }
    }
  }

  private async pull(stream: FeedStream): Promise<boolean> {
    const after = await this.store.cursor(stream)

    if (stream === "deliveries") {
      const page = await this.deliveries.deliveriesSince(after, this.limits.pageSize)

      this.assertValid(after, page)
      await this.store.recordDeliveries(after, page.next, page.records)
      this.metrics.recorded(stream, page.records.length)

      return page.hasMore
    }

    const page = await this.reviews.reviewsSince(after, this.limits.pageSize)

    this.assertValid(after, page)

    const driverReviews = page.records.filter((review) => review.kind === "driver")

    await this.store.recordDriverReviews(after, page.next, driverReviews)
    this.metrics.recorded(stream, driverReviews.length)

    return page.hasMore
  }

  private assertValid<T extends { position: LogCursor }>(after: LogCursor, page: FeedPage<T>): void {
    const violation = feedPageViolation(after, this.limits.pageSize, page)

    if (violation !== undefined) {
      throw new FeedCallFailure("invalid_page", violation)
    }
  }

  private failed(stream: FeedStream, error: unknown): void {
    const kind = error instanceof FeedCallFailure ? error.kind : "store"

    this.metrics.failed(stream, kind)

    if (kind === "unavailable") {
      this.logger.warn({
        message: "a fact feed is unavailable; it is read again on the next tick",
        fields: { stream, cause: error instanceof Error ? error.message : String(error) }
      })

      return
    }

    this.logger.error({ message: "a fact feed stopped short", fields: { stream, kind } }, error)
  }
}

export default CourierFacts

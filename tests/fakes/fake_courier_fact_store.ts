import type { CourierFactStorePort } from "../../src/application/ports/courier_fact_store.port.ts"
import type { CourierDelivery } from "../../src/types/courier_delivery.type.ts"
import type { FeedStream } from "../../src/types/feed_stream.type.ts"
import type { LogCursor } from "../../src/types/log_cursor.type.ts"
import type { ReviewRecord } from "../../src/types/review_record.type.ts"

class FakeCourierFactStore implements CourierFactStorePort {
  readonly cursors = new Map<FeedStream, LogCursor>([
    ["deliveries", { transactionId: 0n, sequence: 0n }],
    ["reviews", { transactionId: 0n, sequence: 0n }]
  ])
  readonly deliveries: CourierDelivery[] = []
  readonly reviews: ReviewRecord[] = []
  readonly caughtUp = new Map<FeedStream, boolean>()
  failNext: Error | undefined

  async cursor(stream: FeedStream): Promise<LogCursor> {
    const cursor = this.cursors.get(stream)

    if (cursor === undefined) {
      throw new Error(`no cursor for ${stream}`)
    }

    return cursor
  }

  async recordDeliveries(
    _from: LogCursor,
    next: LogCursor,
    deliveries: CourierDelivery[],
    caughtUp: boolean
  ): Promise<void> {
    this.failIfAsked()
    this.cursors.set("deliveries", next)
    this.deliveries.push(...deliveries)
    this.caughtUp.set("deliveries", caughtUp)
  }

  async recordDriverReviews(
    _from: LogCursor,
    next: LogCursor,
    reviews: ReviewRecord[],
    caughtUp: boolean
  ): Promise<void> {
    this.failIfAsked()
    this.cursors.set("reviews", next)
    this.reviews.push(...reviews)
    this.caughtUp.set("reviews", caughtUp)
  }

  private failIfAsked(): void {
    const failure = this.failNext

    this.failNext = undefined

    if (failure !== undefined) {
      throw failure
    }
  }
}

export default FakeCourierFactStore

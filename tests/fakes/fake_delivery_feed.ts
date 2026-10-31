import type { DeliveryFeedPort } from "../../src/application/ports/delivery_feed.port.ts"
import type { CourierDelivery } from "../../src/types/courier_delivery.type.ts"
import type { FeedPage } from "../../src/types/feed_page.type.ts"
import type { LogCursor } from "../../src/types/log_cursor.type.ts"

class FakeDeliveryFeed implements DeliveryFeedPort {
  readonly pages: Array<FeedPage<CourierDelivery> | Error> = []
  readonly asked: LogCursor[] = []

  async deliveriesSince(after: LogCursor, _limit: number): Promise<FeedPage<CourierDelivery>> {
    this.asked.push(after)

    const next = this.pages.shift() ?? { records: [], next: after, hasMore: false }

    if (next instanceof Error) {
      throw next
    }

    return next
  }
}

export default FakeDeliveryFeed

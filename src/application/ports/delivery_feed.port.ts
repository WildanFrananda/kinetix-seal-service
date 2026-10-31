import type { CourierDelivery } from "../../types/courier_delivery.type.ts"
import type { FeedPage } from "../../types/feed_page.type.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"

interface DeliveryFeedPort {
  deliveriesSince(after: LogCursor, limit: number): Promise<FeedPage<CourierDelivery>>
}

export type { DeliveryFeedPort }

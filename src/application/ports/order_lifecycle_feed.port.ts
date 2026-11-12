import type { FeedPage } from "../../types/feed_page.type.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"
import type { OrderLifecycleRecord } from "../../types/order_lifecycle_record.type.ts"

interface OrderLifecycleFeedPort {
  eventsSince(after: LogCursor, limit: number): Promise<FeedPage<OrderLifecycleRecord>>
}

export type { OrderLifecycleFeedPort }

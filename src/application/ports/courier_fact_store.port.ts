import type { CourierDelivery } from "../../types/courier_delivery.type.ts"
import type { FeedStream } from "../../types/feed_stream.type.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"
import type { ReviewRecord } from "../../types/review_record.type.ts"

interface CourierFactStorePort {
  cursor(stream: FeedStream): Promise<LogCursor>
  recordDeliveries(from: LogCursor, next: LogCursor, deliveries: CourierDelivery[], caughtUp: boolean): Promise<void>
  recordDriverReviews(from: LogCursor, next: LogCursor, reviews: ReviewRecord[], caughtUp: boolean): Promise<void>
}

export type { CourierFactStorePort }

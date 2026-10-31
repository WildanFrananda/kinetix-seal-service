import type { FeedPage } from "../../types/feed_page.type.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"
import type { ReviewRecord } from "../../types/review_record.type.ts"

interface ReviewFeedPort {
  reviewsSince(after: LogCursor, limit: number): Promise<FeedPage<ReviewRecord>>
}

export type { ReviewFeedPort }

import type { ReviewFeedPort } from "../../src/application/ports/review_feed.port.ts"
import type { FeedPage } from "../../src/types/feed_page.type.ts"
import type { LogCursor } from "../../src/types/log_cursor.type.ts"
import type { ReviewRecord } from "../../src/types/review_record.type.ts"

class FakeReviewFeed implements ReviewFeedPort {
  readonly pages: Array<FeedPage<ReviewRecord> | Error> = []

  async reviewsSince(after: LogCursor, _limit: number): Promise<FeedPage<ReviewRecord>> {
    const next = this.pages.shift() ?? { records: [], next: after, hasMore: false }

    if (next instanceof Error) {
      throw next
    }

    return next
  }
}

export default FakeReviewFeed

import type { CourierFactReaderPort } from "../../src/application/ports/courier_fact_reader.port.ts"
import type { CourierFactSummary } from "../../src/types/courier_fact_summary.type.ts"
import type { FeedCatchUp } from "../../src/types/feed_catch_up.type.ts"

class FakeCourierFactReader implements CourierFactReaderPort {
  readonly summaries = new Map<string, CourierFactSummary>()
  caughtUp: FeedCatchUp

  constructor(caughtUpAt: Date) {
    this.caughtUp = { deliveries: caughtUpAt, reviews: caughtUpAt }
  }

  async summaryOf(principalId: string): Promise<CourierFactSummary> {
    return this.summaries.get(principalId) ?? { deliveries: 0, firstDeliveredAt: undefined, reviews: 0, ratingSum: 0 }
  }

  async catchUp(): Promise<FeedCatchUp> {
    return { ...this.caughtUp }
  }
}

export default FakeCourierFactReader

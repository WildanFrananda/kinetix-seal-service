import type { CourierFactSummary } from "../../types/courier_fact_summary.type.ts"
import type { FeedCatchUp } from "../../types/feed_catch_up.type.ts"

interface CourierFactReaderPort {
  summaryOf(principalId: string): Promise<CourierFactSummary>
  catchUp(): Promise<FeedCatchUp>
}

export type { CourierFactReaderPort }

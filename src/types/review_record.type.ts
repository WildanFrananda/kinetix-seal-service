import type { LogCursor } from "./log_cursor.type.ts"
import type { ReviewRecordKind } from "./review_record_kind.type.ts"

type ReviewRecord = {
  position: LogCursor
  reviewId: string
  kind: ReviewRecordKind
  subjectId: string
  rating: number
  createdAt: Date
}

export type { ReviewRecord }

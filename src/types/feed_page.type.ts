import type { LogCursor } from "./log_cursor.type.ts"

type FeedPage<T> = {
  records: T[]
  next: LogCursor
  hasMore: boolean
}

export type { FeedPage }

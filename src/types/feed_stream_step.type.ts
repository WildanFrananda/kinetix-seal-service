import type { FeedMetricsPort } from "../application/ports/feed_metrics.port.ts"
import type { LoggerPort } from "../application/ports/logger.port.ts"
import type { FeedLimits } from "./feed_limits.type.ts"
import type { FeedPage } from "./feed_page.type.ts"
import type { FeedStream } from "./feed_stream.type.ts"
import type { LogCursor } from "./log_cursor.type.ts"

type FeedStreamStep<T extends { position: LogCursor }> = {
  stream: FeedStream
  limits: FeedLimits
  metrics: FeedMetricsPort
  logger: LoggerPort
  cursor: () => Promise<LogCursor>
  fetch: (after: LogCursor, pageSize: number) => Promise<FeedPage<T>>
  record: (after: LogCursor, page: FeedPage<T>) => Promise<number>
}

export type { FeedStreamStep }

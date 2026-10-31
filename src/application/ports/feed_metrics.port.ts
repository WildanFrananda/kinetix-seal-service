import type { FeedFailureKind } from "../../types/feed_failure_kind.type.ts"
import type { FeedStream } from "../../types/feed_stream.type.ts"

interface FeedMetricsPort {
  recorded(stream: FeedStream, count: number): void
  failed(stream: FeedStream, kind: FeedFailureKind): void
}

export type { FeedMetricsPort }

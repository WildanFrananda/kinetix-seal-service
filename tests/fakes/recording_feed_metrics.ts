import type { FeedMetricsPort } from "../../src/application/ports/feed_metrics.port.ts"
import type { FeedFailureKind } from "../../src/types/feed_failure_kind.type.ts"
import type { FeedStream } from "../../src/types/feed_stream.type.ts"

class RecordingFeedMetrics implements FeedMetricsPort {
  readonly records = new Map<FeedStream, number>()
  readonly failures: Array<{ stream: FeedStream; kind: FeedFailureKind }> = []

  recorded(stream: FeedStream, count: number): void {
    this.records.set(stream, (this.records.get(stream) ?? 0) + count)
  }

  failed(stream: FeedStream, kind: FeedFailureKind): void {
    this.failures.push({ stream, kind })
  }
}

export default RecordingFeedMetrics

import FeedCallFailure from "../domain/feed_call_failure.ts"
import { feedPageViolation } from "../domain/feed_page_violation.ts"
import type { FeedStream } from "../types/feed_stream.type.ts"
import type { FeedStreamStep } from "../types/feed_stream_step.type.ts"
import type { LogCursor } from "../types/log_cursor.type.ts"

function logFeedFailure(step: Pick<FeedStreamStep<never>, "stream" | "metrics" | "logger">, error: unknown): void {
  const kind = error instanceof FeedCallFailure ? error.kind : "store"

  step.metrics.failed(step.stream, kind)

  if (kind === "unavailable") {
    step.logger.warn({
      message: "a fact feed is unavailable; it is read again on the next tick",
      fields: { stream: step.stream, cause: error instanceof Error ? error.message : String(error) }
    })

    return
  }

  step.logger.error({ message: "a fact feed stopped short", fields: { stream: step.stream, kind } }, error)
}

async function pullOnce<T extends { position: LogCursor }>(step: FeedStreamStep<T>): Promise<boolean> {
  const after = await step.cursor()
  const page = await step.fetch(after, step.limits.pageSize)
  const violation = feedPageViolation(after, step.limits.pageSize, page)

  if (violation !== undefined) {
    throw new FeedCallFailure("invalid_page", violation)
  }

  const stored = await step.record(after, page)

  step.metrics.recorded(step.stream as FeedStream, stored)

  return page.hasMore
}

async function drainFeedStream<T extends { position: LogCursor }>(step: FeedStreamStep<T>): Promise<void> {
  for (let pages = 0; pages < step.limits.pagesPerTick; pages += 1) {
    const more = await pullOnce(step).catch((error: unknown) => {
      logFeedFailure(step, error)

      return false
    })

    if (!more) {
      return
    }
  }
}

export { drainFeedStream }

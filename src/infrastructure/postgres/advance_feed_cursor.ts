import type { FeedStream } from "../../types/feed_stream.type.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"
import type { Prisma } from "./generated/client.ts"

async function advanceFeedCursor(
  transaction: Prisma.TransactionClient,
  stream: FeedStream,
  from: LogCursor,
  next: LogCursor,
  caughtUp: boolean
): Promise<void> {
  const moved = await transaction.feedCursor.updateMany({
    where: { stream, throughTransaction: from.transactionId, throughSequence: from.sequence },
    data: {
      throughTransaction: next.transactionId,
      throughSequence: next.sequence,
      ...(caughtUp ? { caughtUpAt: new Date() } : {})
    }
  })

  if (moved.count !== 1) {
    throw new Error(`the ${stream} cursor moved under this page`)
  }
}

export { advanceFeedCursor }

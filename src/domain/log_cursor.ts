import type { LogCursor } from "../types/log_cursor.type.ts"

function compareCursors(left: LogCursor, right: LogCursor): number {
  if (left.transactionId !== right.transactionId) {
    return left.transactionId < right.transactionId ? -1 : 1
  }

  if (left.sequence !== right.sequence) {
    return left.sequence < right.sequence ? -1 : 1
  }

  return 0
}

export { compareCursors }

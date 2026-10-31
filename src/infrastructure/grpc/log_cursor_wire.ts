import { create } from "@bufbuild/protobuf"
import { LogCursorSchema, type LogCursor as WireCursor } from "kinetix-contracts/src/common/v1/common_pb.js"

import FeedCallFailure from "../../domain/feed_call_failure.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"

function toWireCursor(cursor: LogCursor): WireCursor {
  return create(LogCursorSchema, { transactionId: cursor.transactionId, sequence: cursor.sequence })
}

function fromWireCursor(cursor: WireCursor | undefined, what: string): LogCursor {
  if (cursor === undefined) {
    throw new FeedCallFailure("invalid_page", `${what} has no position`)
  }

  return { transactionId: cursor.transactionId, sequence: cursor.sequence }
}

export { fromWireCursor, toWireCursor }

import type { FeedPage } from "../types/feed_page.type.ts"
import type { LogCursor } from "../types/log_cursor.type.ts"
import { compareCursors } from "./log_cursor.ts"

function feedPageViolation<T extends { position: LogCursor }>(
  after: LogCursor,
  limit: number,
  page: FeedPage<T>
): string | undefined {
  if (page.records.length > limit) {
    return `the page holds ${page.records.length} records against a limit of ${limit}`
  }

  let previous = after

  for (const record of page.records) {
    if (compareCursors(record.position, previous) <= 0) {
      return "the records' positions do not increase past the cursor"
    }

    previous = record.position
  }

  if (compareCursors(page.next, previous) !== 0) {
    return page.records.length === 0
      ? "an empty page moved the cursor"
      : "the next cursor is not the last record's position"
  }

  if (page.records.length === 0 && page.hasMore) {
    return "an empty page claims there is more"
  }

  return undefined
}

export { feedPageViolation }

import type { FeedCatchUp } from "../types/feed_catch_up.type.ts"

function factsAreFresh(catchUp: FeedCatchUp, at: Date, maxAgeSeconds: number): boolean {
  return Object.values(catchUp).every((caughtUpAt) => {
    return caughtUpAt !== undefined && at.getTime() - caughtUpAt.getTime() <= maxAgeSeconds * 1000
  })
}

export { factsAreFresh }

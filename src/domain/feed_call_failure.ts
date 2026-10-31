import type { FeedFailureKind } from "../types/feed_failure_kind.type.ts"

class FeedCallFailure extends Error {
  readonly kind: FeedFailureKind

  constructor(kind: FeedFailureKind, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "FeedCallFailure"
    this.kind = kind
  }
}

export default FeedCallFailure

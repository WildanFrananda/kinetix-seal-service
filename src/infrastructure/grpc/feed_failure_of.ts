import { status } from "@grpc/grpc-js"

import FeedCallFailure from "../../domain/feed_call_failure.ts"

const refusals: readonly number[] = [
  status.INVALID_ARGUMENT,
  status.FAILED_PRECONDITION,
  status.PERMISSION_DENIED,
  status.UNAUTHENTICATED,
  status.UNIMPLEMENTED,
  status.NOT_FOUND,
  status.OUT_OF_RANGE
]

function feedFailureOf(peer: string, error: unknown): FeedCallFailure {
  if (error instanceof FeedCallFailure) {
    return error
  }

  const code = typeof error === "object" && error !== null && "code" in error ? Number(error.code) : Number.NaN
  const reason = error instanceof Error ? error.message : String(error)

  if (refusals.includes(code)) {
    return new FeedCallFailure("refused", `${peer} refused the call: ${reason}`, { cause: error })
  }

  return new FeedCallFailure("unavailable", `${peer} could not be reached: ${reason}`, { cause: error })
}

export { feedFailureOf }

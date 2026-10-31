import { create } from "@bufbuild/protobuf"
import { timestampDate } from "@bufbuild/protobuf/wkt"
import { Client } from "@grpc/grpc-js"
import {
  ReviewEvidenceService,
  ReviewKind,
  ReviewsSinceRequestSchema
} from "kinetix-contracts/src/review/v1/review_pb.js"

import type { ReviewFeedPort } from "../../application/ports/review_feed.port.ts"
import FeedCallFailure from "../../domain/feed_call_failure.ts"
import type { FeedPage } from "../../types/feed_page.type.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"
import type { MeshIdentity } from "../../types/mesh_identity.type.ts"
import type { ReviewRecord } from "../../types/review_record.type.ts"
import type { ReviewRecordKind } from "../../types/review_record_kind.type.ts"
import { feedFailureOf } from "./feed_failure_of.ts"
import { fromWireCursor, toWireCursor } from "./log_cursor_wire.ts"
import { meshChannelCredentials } from "./mesh_channel_credentials.ts"
import { unaryCall } from "./unary_call.ts"

const peer = "review"

function kindOf(kind: ReviewKind): ReviewRecordKind {
  if (kind === ReviewKind.DRIVER) {
    return "driver"
  }

  return kind === ReviewKind.PRODUCT ? "product" : "other"
}

class GrpcReviewFeed implements ReviewFeedPort {
  readonly #client: Client
  readonly #timeoutSeconds: number

  constructor(address: string, identity: MeshIdentity, timeoutSeconds: number) {
    this.#client = new Client(address, meshChannelCredentials(identity, peer))
    this.#timeoutSeconds = timeoutSeconds
  }

  async reviewsSince(after: LogCursor, limit: number): Promise<FeedPage<ReviewRecord>> {
    try {
      const response = await unaryCall(
        this.#client,
        ReviewEvidenceService.method.reviewsSince,
        create(ReviewsSinceRequestSchema, { after: toWireCursor(after), limit }),
        this.#timeoutSeconds
      )

      return {
        records: response.reviews.map((review) => {
          if (review.reviewId === "" || review.subjectId === "" || review.createdAt === undefined) {
            throw new FeedCallFailure("invalid_page", `review ${review.reviewId} is missing its subject or time`)
          }

          return {
            position: fromWireCursor(review.position, `review ${review.reviewId}`),
            reviewId: review.reviewId,
            kind: kindOf(review.kind),
            subjectId: review.subjectId,
            rating: review.rating,
            createdAt: timestampDate(review.createdAt)
          }
        }),
        next: fromWireCursor(response.next, "the reviews page"),
        hasMore: response.hasMore
      }
    } catch (error) {
      throw feedFailureOf(peer, error)
    }
  }

  close(): void {
    this.#client.close()
  }
}

export default GrpcReviewFeed

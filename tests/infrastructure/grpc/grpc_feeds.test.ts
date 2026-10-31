import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { create } from "@bufbuild/protobuf"
import { timestampFromDate } from "@bufbuild/protobuf/wkt"
import { Metadata, type ServiceError, status } from "@grpc/grpc-js"
import { LogCursorSchema } from "kinetix-contracts/src/common/v1/common_pb.js"
import {
  type DeliveriesSinceRequest,
  DeliveriesSinceRequestSchema,
  type DeliveriesSinceResponse,
  DeliveriesSinceResponseSchema,
  DeliveryEvidenceSchema
} from "kinetix-contracts/src/fulfillment/v1/delivery_evidence_pb.js"
import {
  ReviewEvidenceSchema,
  ReviewKind,
  ReviewsSinceRequestSchema,
  ReviewsSinceResponseSchema
} from "kinetix-contracts/src/review/v1/review_pb.js"

import FeedCallFailure from "../../../src/domain/feed_call_failure.ts"
import GrpcDeliveryFeed from "../../../src/infrastructure/grpc/grpc_delivery_feed.adapter.ts"
import GrpcReviewFeed from "../../../src/infrastructure/grpc/grpc_review_feed.adapter.ts"
import { meshIdentityOf, startFeedServer, unaryMethod } from "./feed_test_server.ts"

const seal = meshIdentityOf("seal")
const stops: Array<() => void> = []
const deliveriesSince = unaryMethod(
  "/fulfillment.v1.DeliveryEvidenceService/DeliveriesSince",
  DeliveriesSinceRequestSchema,
  DeliveriesSinceResponseSchema
)
const reviewsSince = unaryMethod(
  "/review.v1.ReviewEvidenceService/ReviewsSince",
  ReviewsSinceRequestSchema,
  ReviewsSinceResponseSchema
)

function wireCursor(transactionId: number, sequence: number) {
  return create(LogCursorSchema, { transactionId: BigInt(transactionId), sequence: BigInt(sequence) })
}

function serviceError(code: status, details: string): ServiceError {
  return Object.assign(new Error(details), { code, details, metadata: new Metadata() })
}

function deliveriesPage(after: bigint) {
  return create(DeliveriesSinceResponseSchema, {
    deliveries: [
      create(DeliveryEvidenceSchema, {
        position: wireCursor(Number(after) + 1, 1),
        orderNumber: "KX-1001",
        driverPrincipalId: "drv_7",
        deliveredAt: timestampFromDate(new Date("2026-10-30T08:15:00Z"))
      })
    ],
    next: wireCursor(Number(after) + 1, 1),
    hasMore: false
  })
}

async function matchingAs(
  name: string,
  answer: (request: DeliveriesSinceRequest) => DeliveriesSinceResponse | ServiceError
): Promise<GrpcDeliveryFeed> {
  const server = await startFeedServer(name, deliveriesSince, answer)
  const feed = new GrpcDeliveryFeed(server.address, seal, 5)

  stops.push(server.stop, () => {
    feed.close()
  })

  return feed
}

after(() => {
  for (const stop of stops) {
    stop()
  }
})

describe("the fact feeds over the mesh", () => {
  it("reads matching's deliveries and maps them, sending the cursor it was given", async () => {
    let asked: bigint | undefined
    const feed = await matchingAs("matching", (request) => {
      asked = request.after?.transactionId

      return deliveriesPage(request.after?.transactionId ?? 0n)
    })

    const page = await feed.deliveriesSince({ transactionId: 41n, sequence: 3n }, 500)

    assert.equal(asked, 41n)
    assert.deepEqual(page.next, { transactionId: 42n, sequence: 1n })
    assert.equal(page.records[0]?.driverPrincipalId, "drv_7")
    assert.equal(page.records[0]?.deliveredAt.toISOString(), "2026-10-30T08:15:00.000Z")
  })

  it("reads review's reviews and names their kinds", async () => {
    const server = await startFeedServer("review", reviewsSince, () =>
      create(ReviewsSinceResponseSchema, {
        reviews: [
          create(ReviewEvidenceSchema, {
            position: wireCursor(9, 1),
            reviewId: "rev-1",
            kind: ReviewKind.DRIVER,
            subjectId: "drv_7",
            rating: 5,
            createdAt: timestampFromDate(new Date("2026-10-30T09:00:00Z"))
          }),
          create(ReviewEvidenceSchema, {
            position: wireCursor(9, 2),
            reviewId: "rev-2",
            kind: ReviewKind.PRODUCT,
            subjectId: "sku_1",
            rating: 3,
            createdAt: timestampFromDate(new Date("2026-10-30T09:01:00Z"))
          })
        ],
        next: wireCursor(9, 2),
        hasMore: true
      })
    )
    const feed = new GrpcReviewFeed(server.address, seal, 5)

    stops.push(server.stop, () => {
      feed.close()
    })

    const page = await feed.reviewsSince({ transactionId: 0n, sequence: 0n }, 500)

    assert.deepEqual(
      page.records.map((record) => record.kind),
      ["driver", "product"]
    )
    assert.equal(page.hasMore, true)
  })

  it("refuses a server that answers for matching's name with another service's identity", async () => {
    const feed = await matchingAs("impostor", (request) => deliveriesPage(request.after?.transactionId ?? 0n))

    await assert.rejects(
      feed.deliveriesSince({ transactionId: 0n, sequence: 0n }, 500),
      (error: unknown) =>
        error instanceof FeedCallFailure &&
        error.kind === "unavailable" &&
        error.message.includes("dialled matching but the server is review")
    )
  })

  it("refuses a server whose certificate another authority signed", async () => {
    const feed = await matchingAs("foreign-matching", (request) => deliveriesPage(request.after?.transactionId ?? 0n))

    await assert.rejects(
      feed.deliveriesSince({ transactionId: 0n, sequence: 0n }, 500),
      (error: unknown) => error instanceof FeedCallFailure && error.kind === "unavailable"
    )
  })

  it("names matching's refusal of seal a refusal", async () => {
    const feed = await matchingAs("matching", () =>
      serviceError(status.PERMISSION_DENIED, "service 'seal' may not call fulfillment.v1.DeliveryEvidenceService")
    )

    await assert.rejects(
      feed.deliveriesSince({ transactionId: 0n, sequence: 0n }, 500),
      (error: unknown) => error instanceof FeedCallFailure && error.kind === "refused"
    )
  })

  it("refuses a delivery that carries no time", async () => {
    const feed = await matchingAs("matching", () =>
      create(DeliveriesSinceResponseSchema, {
        deliveries: [
          create(DeliveryEvidenceSchema, {
            position: wireCursor(1, 1),
            orderNumber: "KX-1",
            driverPrincipalId: "drv_7"
          })
        ],
        next: wireCursor(1, 1),
        hasMore: false
      })
    )

    await assert.rejects(
      feed.deliveriesSince({ transactionId: 0n, sequence: 0n }, 500),
      (error: unknown) => error instanceof FeedCallFailure && error.kind === "invalid_page"
    )
  })
})

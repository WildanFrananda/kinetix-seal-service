import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { create } from "@bufbuild/protobuf"
import { timestampFromDate } from "@bufbuild/protobuf/wkt"
import { LogCursorSchema, OrderStatus } from "kinetix-contracts/src/common/v1/common_pb.js"
import {
  LifecycleActorKind,
  LifecycleEventKind,
  LifecycleEventSchema,
  LifecycleEventsSinceRequestSchema,
  type LifecycleEventsSinceResponse,
  LifecycleEventsSinceResponseSchema
} from "kinetix-contracts/src/order/v1/lifecycle_pb.js"

import FeedCallFailure from "../../../src/domain/feed_call_failure.ts"
import GrpcOrderLifecycleFeed from "../../../src/infrastructure/grpc/grpc_order_lifecycle_feed.adapter.ts"
import { meshIdentityOf, startFeedServer, unaryMethod } from "./feed_test_server.ts"

const seal = meshIdentityOf("seal")
const stops: Array<() => void> = []
const eventsSince = unaryMethod(
  "/order.v1.OrderLifecycleService/LifecycleEventsSince",
  LifecycleEventsSinceRequestSchema,
  LifecycleEventsSinceResponseSchema
)

function wireCursor(transactionId: number, sequence: number) {
  return create(LogCursorSchema, { transactionId: BigInt(transactionId), sequence: BigInt(sequence) })
}

function event(sequence: number, toStatus: OrderStatus, overrides: { buyerPrincipalId?: string } = {}) {
  return create(LifecycleEventSchema, {
    position: wireCursor(50, sequence),
    orderNumber: "ORD-20261108-8AA3A287",
    kind: LifecycleEventKind.STATUS_CHANGED,
    toStatus,
    actorKind: LifecycleActorKind.DRIVER,
    actorPrincipalId: "drv_1",
    buyerPrincipalId: overrides.buyerPrincipalId ?? "buy_1",
    merchantPrincipalId: "mer_1",
    occurredAt: timestampFromDate(new Date("2026-11-08T10:00:00Z"))
  })
}

async function orderAs(name: string, page: LifecycleEventsSinceResponse): Promise<GrpcOrderLifecycleFeed> {
  const server = await startFeedServer(name, eventsSince, () => page)
  const feed = new GrpcOrderLifecycleFeed(server.address, seal, 5)

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

describe("order's lifecycle log over the mesh", () => {
  it("names the deliveries and keeps every other event's position", async () => {
    const feed = await orderAs(
      "order",
      create(LifecycleEventsSinceResponseSchema, {
        events: [event(1, OrderStatus.PAID), event(2, OrderStatus.DELIVERED)],
        next: wireCursor(50, 2),
        hasMore: false
      })
    )

    const page = await feed.eventsSince({ transactionId: 0n, sequence: 0n }, 500)

    assert.equal(page.records.length, 2)
    assert.equal(page.records[0]?.delivery, undefined)
    assert.deepEqual(page.records[1]?.delivery, {
      orderNumber: "ORD-20261108-8AA3A287",
      buyerPrincipalId: "buy_1",
      merchantPrincipalId: "mer_1",
      deliveredAt: new Date("2026-11-08T10:00:00Z")
    })

    assert.deepEqual(page.next, { transactionId: 50n, sequence: 2n })
  })

  it("refuses a delivery that names no buyer", async () => {
    const feed = await orderAs(
      "order",
      create(LifecycleEventsSinceResponseSchema, {
        events: [event(1, OrderStatus.DELIVERED, { buyerPrincipalId: "" })],
        next: wireCursor(50, 1),
        hasMore: false
      })
    )

    await assert.rejects(
      feed.eventsSince({ transactionId: 0n, sequence: 0n }, 500),
      (error: unknown) => error instanceof FeedCallFailure && error.kind === "invalid_page"
    )
  })

  it("refuses a server that is not order", async () => {
    const feed = await orderAs(
      "matching",
      create(LifecycleEventsSinceResponseSchema, { events: [], next: wireCursor(0, 0), hasMore: false })
    )

    await assert.rejects(
      feed.eventsSince({ transactionId: 0n, sequence: 0n }, 500),
      (error: unknown) =>
        error instanceof FeedCallFailure &&
        error.kind === "unavailable" &&
        error.message.includes("dialled order but the server is matching")
    )
  })
})

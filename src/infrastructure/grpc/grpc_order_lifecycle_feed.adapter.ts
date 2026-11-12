import { create } from "@bufbuild/protobuf"
import { timestampDate } from "@bufbuild/protobuf/wkt"
import { Client } from "@grpc/grpc-js"
import { OrderStatus } from "kinetix-contracts/src/common/v1/common_pb.js"
import {
  type LifecycleEvent,
  LifecycleEventKind,
  LifecycleEventsSinceRequestSchema,
  OrderLifecycleService
} from "kinetix-contracts/src/order/v1/lifecycle_pb.js"

import type { OrderLifecycleFeedPort } from "../../application/ports/order_lifecycle_feed.port.ts"
import FeedCallFailure from "../../domain/feed_call_failure.ts"
import type { DeliveredOrder } from "../../types/delivered_order.type.ts"
import type { FeedPage } from "../../types/feed_page.type.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"
import type { MeshIdentity } from "../../types/mesh_identity.type.ts"
import type { OrderLifecycleRecord } from "../../types/order_lifecycle_record.type.ts"
import { feedFailureOf } from "./feed_failure_of.ts"
import { fromWireCursor, toWireCursor } from "./log_cursor_wire.ts"
import { meshChannelCredentials } from "./mesh_channel_credentials.ts"
import { unaryCall } from "./unary_call.ts"

const peer = "order"

function deliveryOf(event: LifecycleEvent): DeliveredOrder | undefined {
  if (event.kind !== LifecycleEventKind.STATUS_CHANGED || event.toStatus !== OrderStatus.DELIVERED) {
    return undefined
  }

  if (
    event.orderNumber === "" ||
    event.buyerPrincipalId === "" ||
    event.merchantPrincipalId === "" ||
    event.occurredAt === undefined
  ) {
    throw new FeedCallFailure(
      "invalid_page",
      `the delivery of ${event.orderNumber} is missing its buyer, merchant or time`
    )
  }

  return {
    orderNumber: event.orderNumber,
    buyerPrincipalId: event.buyerPrincipalId,
    merchantPrincipalId: event.merchantPrincipalId,
    deliveredAt: timestampDate(event.occurredAt)
  }
}

function recordOf(event: LifecycleEvent): OrderLifecycleRecord {
  return {
    position: fromWireCursor(event.position, `the event of ${event.orderNumber}`),
    delivery: deliveryOf(event)
  }
}

class GrpcOrderLifecycleFeed implements OrderLifecycleFeedPort {
  private readonly client: Client
  private readonly timeoutSeconds: number

  constructor(address: string, identity: MeshIdentity, timeoutSeconds: number) {
    this.client = new Client(address, meshChannelCredentials(identity, peer))
    this.timeoutSeconds = timeoutSeconds
  }

  async eventsSince(after: LogCursor, limit: number): Promise<FeedPage<OrderLifecycleRecord>> {
    try {
      const response = await unaryCall(
        this.client,
        OrderLifecycleService.method.lifecycleEventsSince,
        create(LifecycleEventsSinceRequestSchema, { after: toWireCursor(after), limit }),
        this.timeoutSeconds
      )

      return {
        records: response.events.map(recordOf),
        next: fromWireCursor(response.next, "the order lifecycle page"),
        hasMore: response.hasMore
      }
    } catch (error) {
      throw feedFailureOf(peer, error)
    }
  }

  close(): void {
    this.client.close()
  }
}

export default GrpcOrderLifecycleFeed

import { create } from "@bufbuild/protobuf"
import { timestampDate } from "@bufbuild/protobuf/wkt"
import { Client } from "@grpc/grpc-js"
import {
  DeliveriesSinceRequestSchema,
  DeliveryEvidenceService
} from "kinetix-contracts/src/fulfillment/v1/delivery_evidence_pb.js"

import type { DeliveryFeedPort } from "../../application/ports/delivery_feed.port.ts"
import FeedCallFailure from "../../domain/feed_call_failure.ts"
import type { CourierDelivery } from "../../types/courier_delivery.type.ts"
import type { FeedPage } from "../../types/feed_page.type.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"
import type { MeshIdentity } from "../../types/mesh_identity.type.ts"
import { feedFailureOf } from "./feed_failure_of.ts"
import { fromWireCursor, toWireCursor } from "./log_cursor_wire.ts"
import { meshChannelCredentials } from "./mesh_channel_credentials.ts"
import { unaryCall } from "./unary_call.ts"

const peer = "matching"

class GrpcDeliveryFeed implements DeliveryFeedPort {
  readonly #client: Client
  readonly #timeoutSeconds: number

  constructor(address: string, identity: MeshIdentity, timeoutSeconds: number) {
    this.#client = new Client(address, meshChannelCredentials(identity, peer))
    this.#timeoutSeconds = timeoutSeconds
  }

  async deliveriesSince(after: LogCursor, limit: number): Promise<FeedPage<CourierDelivery>> {
    try {
      const response = await unaryCall(
        this.#client,
        DeliveryEvidenceService.method.deliveriesSince,
        create(DeliveriesSinceRequestSchema, { after: toWireCursor(after), limit }),
        this.#timeoutSeconds
      )

      return {
        records: response.deliveries.map((delivery) => {
          if (delivery.driverPrincipalId === "" || delivery.orderNumber === "" || delivery.deliveredAt === undefined) {
            throw new FeedCallFailure("invalid_page", `delivery ${delivery.orderNumber} is missing its driver or time`)
          }

          return {
            position: fromWireCursor(delivery.position, `delivery ${delivery.orderNumber}`),
            orderNumber: delivery.orderNumber,
            driverPrincipalId: delivery.driverPrincipalId,
            deliveredAt: timestampDate(delivery.deliveredAt)
          }
        }),
        next: fromWireCursor(response.next, "the deliveries page"),
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

export default GrpcDeliveryFeed

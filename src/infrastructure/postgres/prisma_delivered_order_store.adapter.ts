import type { DeliveredOrderStorePort } from "../../application/ports/delivered_order_store.port.ts"
import type { DeliveredOrder } from "../../types/delivered_order.type.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"
import { advanceFeedCursor } from "./advance_feed_cursor.ts"
import type { PrismaClient } from "./generated/client.ts"

class PrismaDeliveredOrderStore implements DeliveredOrderStorePort {
  private readonly prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async cursor(): Promise<LogCursor> {
    const row = await this.prisma.feedCursor.findUnique({ where: { stream: "orders" } })

    if (row === null) {
      throw new Error("feed_cursors holds no row for orders: its migration seeds one")
    }

    return { transactionId: row.throughTransaction, sequence: row.throughSequence }
  }

  async recordDelivered(from: LogCursor, next: LogCursor, orders: DeliveredOrder[], caughtUp: boolean): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await advanceFeedCursor(transaction, "orders", from, next, caughtUp)

      if (orders.length > 0) {
        await transaction.deliveredOrder.createMany({
          data: orders.map((order) => ({
            orderNumber: order.orderNumber,
            buyerPrincipalId: order.buyerPrincipalId,
            merchantPrincipalId: order.merchantPrincipalId,
            deliveredAt: order.deliveredAt
          })),
          skipDuplicates: true
        })
      }
    })
  }
}

export default PrismaDeliveredOrderStore

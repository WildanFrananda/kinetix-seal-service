import type { CourierFactStorePort } from "../../application/ports/courier_fact_store.port.ts"
import type { CourierDelivery } from "../../types/courier_delivery.type.ts"
import type { FeedStream } from "../../types/feed_stream.type.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"
import type { ReviewRecord } from "../../types/review_record.type.ts"
import type { Prisma, PrismaClient } from "./generated/client.ts"

async function advance(
  transaction: Prisma.TransactionClient,
  stream: FeedStream,
  from: LogCursor,
  next: LogCursor
): Promise<void> {
  const moved = await transaction.feedCursor.updateMany({
    where: { stream, throughTransaction: from.transactionId, throughSequence: from.sequence },
    data: { throughTransaction: next.transactionId, throughSequence: next.sequence }
  })

  if (moved.count !== 1) {
    throw new Error(`the ${stream} cursor moved under this page`)
  }
}

class PrismaCourierFactStore implements CourierFactStorePort {
  readonly #prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma
  }

  async cursor(stream: FeedStream): Promise<LogCursor> {
    const row = await this.#prisma.feedCursor.findUnique({ where: { stream } })

    if (row === null) {
      throw new Error(`feed_cursors holds no row for ${stream}: its migration seeds one`)
    }

    return { transactionId: row.throughTransaction, sequence: row.throughSequence }
  }

  async recordDeliveries(from: LogCursor, next: LogCursor, deliveries: CourierDelivery[]): Promise<void> {
    await this.#prisma.$transaction(async (transaction) => {
      await advance(transaction, "deliveries", from, next)

      if (deliveries.length > 0) {
        await transaction.courierDelivery.createMany({
          data: deliveries.map((delivery) => ({
            orderNumber: delivery.orderNumber,
            driverPrincipalId: delivery.driverPrincipalId,
            deliveredAt: delivery.deliveredAt
          })),
          skipDuplicates: true
        })
      }
    })
  }

  async recordDriverReviews(from: LogCursor, next: LogCursor, reviews: ReviewRecord[]): Promise<void> {
    await this.#prisma.$transaction(async (transaction) => {
      await advance(transaction, "reviews", from, next)

      if (reviews.length > 0) {
        await transaction.driverReview.createMany({
          data: reviews.map((review) => ({
            reviewId: review.reviewId,
            driverPrincipalId: review.subjectId,
            rating: review.rating,
            createdAt: review.createdAt
          })),
          skipDuplicates: true
        })
      }
    })
  }
}

export default PrismaCourierFactStore

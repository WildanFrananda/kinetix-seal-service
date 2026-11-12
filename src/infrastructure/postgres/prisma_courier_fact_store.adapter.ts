import type { CourierFactReaderPort } from "../../application/ports/courier_fact_reader.port.ts"
import type { CourierFactStorePort } from "../../application/ports/courier_fact_store.port.ts"
import type { CourierDelivery } from "../../types/courier_delivery.type.ts"
import type { CourierFactSummary } from "../../types/courier_fact_summary.type.ts"
import type { FeedCatchUp } from "../../types/feed_catch_up.type.ts"
import type { FeedStream } from "../../types/feed_stream.type.ts"
import type { LogCursor } from "../../types/log_cursor.type.ts"
import type { ReviewRecord } from "../../types/review_record.type.ts"
import { advanceFeedCursor } from "./advance_feed_cursor.ts"
import type { PrismaClient } from "./generated/client.ts"

function caughtUpOf(rows: { stream: string; caughtUpAt: Date | null }[], stream: FeedStream): Date | undefined {
  return rows.find((row) => row.stream === stream)?.caughtUpAt ?? undefined
}

class PrismaCourierFactStore implements CourierFactStorePort, CourierFactReaderPort {
  private readonly prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async cursor(stream: FeedStream): Promise<LogCursor> {
    const row = await this.prisma.feedCursor.findUnique({ where: { stream } })

    if (row === null) {
      throw new Error(`feed_cursors holds no row for ${stream}: its migration seeds one`)
    }

    return { transactionId: row.throughTransaction, sequence: row.throughSequence }
  }

  async recordDeliveries(
    from: LogCursor,
    next: LogCursor,
    deliveries: CourierDelivery[],
    caughtUp: boolean
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await advanceFeedCursor(transaction, "deliveries", from, next, caughtUp)

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

  async recordDriverReviews(
    from: LogCursor,
    next: LogCursor,
    reviews: ReviewRecord[],
    caughtUp: boolean
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await advanceFeedCursor(transaction, "reviews", from, next, caughtUp)

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

  async summaryOf(principalId: string): Promise<CourierFactSummary> {
    const [deliveries, reviews] = await Promise.all([
      this.prisma.courierDelivery.aggregate({
        where: { driverPrincipalId: principalId },
        _count: { _all: true },
        _min: { deliveredAt: true }
      }),
      this.prisma.driverReview.aggregate({
        where: { driverPrincipalId: principalId },
        _count: { _all: true },
        _sum: { rating: true }
      })
    ])

    return {
      deliveries: deliveries._count._all,
      firstDeliveredAt: deliveries._min.deliveredAt ?? undefined,
      reviews: reviews._count._all,
      ratingSum: reviews._sum.rating ?? 0
    }
  }

  async catchUp(): Promise<FeedCatchUp> {
    const rows = await this.prisma.feedCursor.findMany({ select: { stream: true, caughtUpAt: true } })

    return { deliveries: caughtUpOf(rows, "deliveries"), reviews: caughtUpOf(rows, "reviews") }
  }
}

export default PrismaCourierFactStore

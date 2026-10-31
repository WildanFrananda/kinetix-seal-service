import type { CourierDelivery } from "../../src/types/courier_delivery.type.ts"
import type { ReviewRecord } from "../../src/types/review_record.type.ts"
import type { ReviewRecordKind } from "../../src/types/review_record_kind.type.ts"

function cursorAt(transactionId: number, sequence: number) {
  return { transactionId: BigInt(transactionId), sequence: BigInt(sequence) }
}

function delivery(transactionId: number, sequence: number, driver = "drv_1"): CourierDelivery {
  return {
    position: cursorAt(transactionId, sequence),
    orderNumber: `KX-${transactionId}-${sequence}`,
    driverPrincipalId: driver,
    deliveredAt: new Date("2026-10-30T08:00:00Z")
  }
}

function review(transactionId: number, sequence: number, kind: ReviewRecordKind, rating = 5): ReviewRecord {
  return {
    position: cursorAt(transactionId, sequence),
    reviewId: `rev-${transactionId}-${sequence}`,
    kind,
    subjectId: kind === "driver" ? "drv_1" : "sku_9",
    rating,
    createdAt: new Date("2026-10-30T09:00:00Z")
  }
}

export { cursorAt, delivery, review }

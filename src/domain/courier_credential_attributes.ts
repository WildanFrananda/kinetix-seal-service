import type { CourierFactSummary } from "../types/courier_fact_summary.type.ts"
import { issueDayOf } from "./issue_day.ts"

function courierAttributes(summary: CourierFactSummary, issueDay: number): bigint[] | undefined {
  if (summary.deliveries === 0 || summary.firstDeliveredAt === undefined) {
    return undefined
  }

  const ratingHundredths = summary.reviews === 0 ? 0n : (BigInt(summary.ratingSum) * 100n) / BigInt(summary.reviews)
  const daysActive = Math.max(0, issueDay - issueDayOf(summary.firstDeliveredAt))

  return [BigInt(summary.deliveries), ratingHundredths, BigInt(daysActive), BigInt(issueDay)]
}

export { courierAttributes }

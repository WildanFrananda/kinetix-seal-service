import { timingSafeEqual } from "node:crypto"

import type { InspectedReportCall } from "../types/inspected_report_call.type.ts"
import type { InspectedReportTransaction } from "../types/inspected_report_transaction.type.ts"

function matchingReportCall(
  inspected: InspectedReportTransaction,
  contractAddress: string,
  expectedDigest: Uint8Array
): InspectedReportCall | undefined {
  if (inspected.offers !== 0 || inspected.otherActions !== 0 || inspected.calls.length !== 1) {
    return undefined
  }

  const call = inspected.calls[0]

  if (call === undefined || call.entryPoint !== "report") {
    return undefined
  }

  if (call.address.toLowerCase() !== contractAddress.toLowerCase()) {
    return undefined
  }

  if (call.digest.length !== expectedDigest.length || !timingSafeEqual(call.digest, expectedDigest)) {
    return undefined
  }

  return call
}

export { matchingReportCall }

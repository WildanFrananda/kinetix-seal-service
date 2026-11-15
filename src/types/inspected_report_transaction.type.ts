import type { InspectedReportCall } from "./inspected_report_call.type.ts"

type InspectedReportTransaction = {
  calls: InspectedReportCall[]
  otherActions: number
  offers: number
}

export type { InspectedReportTransaction }

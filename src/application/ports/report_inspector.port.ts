import type { InspectedReportTransaction } from "../../types/inspected_report_transaction.type.ts"

interface ReportInspectorPort {
  inspect(bytes: Uint8Array): InspectedReportTransaction | undefined
}

export type { ReportInspectorPort }

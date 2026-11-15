import type { ReportInspectorPort } from "../../src/application/ports/report_inspector.port.ts"
import type { InspectedReportTransaction } from "../../src/types/inspected_report_transaction.type.ts"

class FakeReportInspector implements ReportInspectorPort {
  result: InspectedReportTransaction | undefined = undefined

  inspect(_bytes: Uint8Array): InspectedReportTransaction | undefined {
    return this.result
  }
}

export default FakeReportInspector

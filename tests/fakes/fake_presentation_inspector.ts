import type { PresentationInspectorPort } from "../../src/application/ports/presentation_inspector.port.ts"
import type { InspectedTransaction } from "../../src/types/inspected_transaction.type.ts"

class FakePresentationInspector implements PresentationInspectorPort {
  next: InspectedTransaction | undefined = {
    calls: [{ address: "02cc", entryPoint: "present" }],
    otherActions: 0,
    offers: 0
  }

  inspect(_transaction: Uint8Array): InspectedTransaction | undefined {
    return this.next
  }
}

export default FakePresentationInspector

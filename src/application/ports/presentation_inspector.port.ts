import type { InspectedTransaction } from "../../types/inspected_transaction.type.ts"

interface PresentationInspectorPort {
  inspect(transaction: Uint8Array): InspectedTransaction | undefined
}

export type { PresentationInspectorPort }

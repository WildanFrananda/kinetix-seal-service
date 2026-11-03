import {
  type Binding,
  type Proof,
  type SignatureEnabled,
  Transaction
} from "@midnight-ntwrk/midnight-js-protocol/ledger"

import type { PresentationInspectorPort } from "../../application/ports/presentation_inspector.port.ts"
import type { InspectedCall } from "../../types/inspected_call.type.ts"
import type { InspectedTransaction } from "../../types/inspected_transaction.type.ts"

function boundTransactionOf(bytes: Uint8Array): Transaction<SignatureEnabled, Proof, Binding> | undefined {
  try {
    return Transaction.deserialize<SignatureEnabled, Proof, Binding>("signature", "proof", "binding", bytes)
  } catch {
    return undefined
  }
}

class LedgerPresentationInspector implements PresentationInspectorPort {
  inspect(bytes: Uint8Array): InspectedTransaction | undefined {
    const transaction = boundTransactionOf(bytes)

    if (transaction === undefined || transaction.rewards !== undefined) {
      return undefined
    }

    const calls: InspectedCall[] = []
    let otherActions = 0

    for (const intent of transaction.intents?.values() ?? []) {
      for (const action of intent.actions) {
        if ("entryPoint" in action) {
          calls.push({
            address: String(action.address),
            entryPoint:
              typeof action.entryPoint === "string" ? action.entryPoint : new TextDecoder().decode(action.entryPoint)
          })
        } else {
          otherActions += 1
        }
      }
    }

    const offers = (transaction.guaranteedOffer === undefined ? 0 : 1) + (transaction.fallibleOffer?.size ?? 0)

    return { calls, otherActions, offers }
  }
}

export default LedgerPresentationInspector

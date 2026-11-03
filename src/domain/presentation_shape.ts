import type { InspectedTransaction } from "../types/inspected_transaction.type.ts"

function presentationFault(inspected: InspectedTransaction, contractAddress: string): string | undefined {
  if (inspected.offers > 0 || inspected.otherActions > 0) {
    return "a presentation moves no coins and calls nothing else"
  }

  const [call] = inspected.calls

  if (call === undefined || inspected.calls.length !== 1) {
    return "a presentation is exactly one call"
  }

  if (call.entryPoint !== "present") {
    return "the call is not present"
  }

  if (call.address !== contractAddress) {
    return "the call is not to the active registry"
  }

  return undefined
}

export { presentationFault }

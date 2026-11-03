import type { InspectedCall } from "./inspected_call.type.ts"

type InspectedTransaction = {
  calls: InspectedCall[]
  otherActions: number
  offers: number
}

export type { InspectedTransaction }

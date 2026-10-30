import type { RegistryRetirementReason } from "./registry_retirement_reason.type.ts"

type RegistryRetirement = {
  generation: number
  reason: RegistryRetirementReason
}

export type { RegistryRetirement }

import type { RegistryDrillRefusal } from "./registry_drill_refusal.type.ts"

type RegistryDrillOutcome =
  | { kind: "retired"; generation: number; networkId: string }
  | { kind: "refused"; reason: RegistryDrillRefusal; activeGeneration: number | undefined }

export type { RegistryDrillOutcome }

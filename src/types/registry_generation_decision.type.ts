import type { RegistryRetirement } from "./registry_retirement.type.ts"

type RegistryGenerationDecision = {
  action: "keep" | "wait" | "deploy"
  retire: RegistryRetirement[]
}

export type { RegistryGenerationDecision }

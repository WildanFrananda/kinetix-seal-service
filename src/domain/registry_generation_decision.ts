import type { AnchorObservation } from "../types/anchor_observation.type.ts"
import type { RegistryGeneration } from "../types/registry_generation.type.ts"
import type { RegistryGenerationDecision } from "../types/registry_generation_decision.type.ts"
import type { RegistryRetirement } from "../types/registry_retirement.type.ts"

function confirmedAnchor(previous: AnchorObservation | undefined, current: AnchorObservation): AnchorObservation {
  if (current === "replaced" && previous !== "replaced") {
    return "unknown"
  }

  return current
}

function decideRegistryGeneration(
  generations: readonly RegistryGeneration[],
  buildDigest: string,
  anchor: AnchorObservation | undefined
): RegistryGenerationDecision {
  const interrupted: RegistryRetirement[] = generations
    .filter((generation) => generation.status === "deploying")
    .map((generation) => ({ generation: generation.generation, reason: "interrupted" }))
  const active = generations.find((generation) => generation.status === "active")

  if (active === undefined) {
    return { action: "deploy", retire: interrupted }
  }

  if (active.buildDigest !== buildDigest) {
    return { action: "deploy", retire: [...interrupted, { generation: active.generation, reason: "contract_rebuilt" }] }
  }

  if (anchor === "replaced") {
    return { action: "deploy", retire: [...interrupted, { generation: active.generation, reason: "chain_reset" }] }
  }

  if (anchor === "unchanged") {
    return { action: "keep", retire: interrupted }
  }

  return { action: "wait", retire: interrupted }
}

export { confirmedAnchor, decideRegistryGeneration }

import type { LoggerPort } from "../application/ports/logger.port.ts"
import type { PredicateChainPort } from "../application/ports/predicate_chain.port.ts"
import type { PredicateMetricsPort } from "../application/ports/predicate_metrics.port.ts"
import type { PredicatePlacementStorePort } from "../application/ports/predicate_placement_store.port.ts"
import type { PredicateTemplateStorePort } from "../application/ports/predicate_template_store.port.ts"
import type { RegistryGenerationStorePort } from "../application/ports/registry_generation_store.port.ts"

type PredicateKeeperDependencies = {
  chain: PredicateChainPort
  templates: PredicateTemplateStorePort
  placements: PredicatePlacementStorePort
  generations: RegistryGenerationStorePort
  metrics: PredicateMetricsPort
  logger: LoggerPort
  clock: () => Date
  periodDays: number
}

export type { PredicateKeeperDependencies }

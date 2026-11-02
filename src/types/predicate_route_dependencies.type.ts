import type { LoggerPort } from "../application/ports/logger.port.ts"
import type { TokenVerifierPort } from "../application/ports/token_verifier.port.ts"
import type PredicateCatalogue from "../application/predicate_catalogue.service.ts"
import type { EstateMetrics } from "./estate_metrics.type.ts"

type PredicateRouteDependencies = {
  predicates: PredicateCatalogue
  tokens: TokenVerifierPort
  logger: LoggerPort
  metrics: EstateMetrics
  clock: () => Date
}

export type { PredicateRouteDependencies }

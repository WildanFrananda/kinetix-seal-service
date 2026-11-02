import type { PredicateStanding } from "./predicate_standing.type.ts"
import type { RegistryReference } from "./registry_reference.type.ts"

type PredicateListing = {
  registry: RegistryReference | undefined
  standings: PredicateStanding[]
}

export type { PredicateListing }

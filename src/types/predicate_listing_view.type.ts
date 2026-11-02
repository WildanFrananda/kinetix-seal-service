import type { PredicateView } from "./predicate_view.type.ts"
import type { RegistryReference } from "./registry_reference.type.ts"

type PredicateListingView = {
  registry: RegistryReference | null
  predicates: PredicateView[]
}

export type { PredicateListingView }

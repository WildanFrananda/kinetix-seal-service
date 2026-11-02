import type { RegistryPredicate } from "./registry_predicate.type.ts"

type PredicateRowStanding = {
  id: Uint8Array
  predicate: RegistryPredicate
  minimumIssueDay: number
  current: boolean
  placed: boolean
}

export type { PredicateRowStanding }

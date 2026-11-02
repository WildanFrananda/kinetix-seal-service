import type { RegistryPredicate } from "./registry_predicate.type.ts"

type PredicateRow = {
  predicate: RegistryPredicate
  period: number
  minimumIssueDay: number
  current: boolean
}

export type { PredicateRow }

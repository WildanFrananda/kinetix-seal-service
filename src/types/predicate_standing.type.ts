import type { PredicateRowStanding } from "./predicate_row_standing.type.ts"
import type { PredicateTemplate } from "./predicate_template.type.ts"

type PredicateStanding = {
  template: PredicateTemplate
  rows: PredicateRowStanding[]
}

export type { PredicateStanding }

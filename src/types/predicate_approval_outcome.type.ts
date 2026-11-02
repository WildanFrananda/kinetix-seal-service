import type { PredicateStanding } from "./predicate_standing.type.ts"

type PredicateApprovalOutcome =
  | { kind: "approved"; standing: PredicateStanding }
  | { kind: "duplicate" }
  | { kind: "full" }
  | { kind: "not_admin" }

export type { PredicateApprovalOutcome }

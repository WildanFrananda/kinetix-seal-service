import type { PredicateRowView } from "./predicate_row_view.type.ts"

type PredicateView = {
  id: string
  status: "live" | "withdrawn"
  class: string
  classId: string
  label: string
  minimums: Record<string, number>
  freshnessDays: number
  approvedAt: string
  withdrawnAt: string | null
  rows: PredicateRowView[]
}

export type { PredicateView }

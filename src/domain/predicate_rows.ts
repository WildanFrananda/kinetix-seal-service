import type { PredicateRow } from "../types/predicate_row.type.ts"
import type { PredicateTemplate } from "../types/predicate_template.type.ts"

function rowFor(template: PredicateTemplate, period: number, periodDays: number, current: boolean): PredicateRow {
  const minimumIssueDay = Math.max(0, period * periodDays - template.freshnessDays)

  return {
    predicate: { classId: template.classId, minimums: [...template.minimums, BigInt(minimumIssueDay)] },
    period,
    minimumIssueDay,
    current
  }
}

function predicateRowsOf(template: PredicateTemplate, day: number, periodDays: number): PredicateRow[] {
  const period = Math.floor(day / periodDays)
  const current = rowFor(template, period, periodDays, true)

  if (period === 0) {
    return [current]
  }

  return [current, rowFor(template, period - 1, periodDays, false)]
}

export { predicateRowsOf }
